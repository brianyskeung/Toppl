# Spec: hold-detection

Module id: `hold-detection` · Depends on: walls · Index: [CAPABILITY-MAP.md](CAPABILITY-MAP.md) · Shared conventions: [SPEC.md](SPEC.md)

## Objective

Turn a wall photo into proposed holds (outlines, plus types when the model provides them) that the user accepts or corrects in the `walls` hold editor. This is the project's **main ML learning goal**: integrating existing models into a production backend, covering model selection and evaluation, serving, async jobs, observability, and cost control. No custom model training unless off-the-shelf results miss the targets below.

### User stories

1. As a wall admin, I tap "Detect holds" on a draft layout and see progress while it runs.
2. Within a reasonable time, proposed holds appear in the editor in a distinct style.
3. I accept all, accept individually, adjust, or delete proposals; I can also add holds the model missed.
4. If detection fails or times out, I get a clear message and can keep editing manually or retry.
5. As the builder, I can see how well each model version performs on real usage: how many proposals users kept, edited, or deleted, and how many holds they added by hand.

## Architecture

```
Mobile app ──(1) invoke──▶ Edge Function `detect-holds`
                               │  verifies JWT + can_admin_wall, rate limit,
                               │  creates hold_detections row (status=queued)
                               │  returns { detectionId } immediately
                               └─(2) background (EdgeRuntime.waitUntil) ─▶ ML service POST /v1/detect
                                                                            │ fetches image via signed URL
                                                                            │ runs HoldDetector
                                                                            ◀─ returns detections
                               (3) writes holds (source=detected) + updates row (succeeded/failed)
Mobile app ◀─(4) Realtime subscription on hold_detections row (poll fallback every 3s)
```

- The ML service never receives user credentials and never touches the database. It accepts a short-lived signed image URL and returns JSON. It's stateless, so it can scale to zero.
- Service-to-service auth: the Edge Function sends a shared secret header (`X-Toppl-Service-Key`) stored as a secret on both sides.
- Hosting: managed cloud, decided in the spike (Task 1 of this module's plan). Candidates are Google Cloud Run (CPU), Modal (serverless GPU), or the FastAPI service calling a hosted inference API (e.g. Roboflow Hosted Inference, Replicate). Whatever wins, the HTTP contract below stays the same.

### ML service contract

```
POST /v1/detect
Headers: X-Toppl-Service-Key: <secret>
Body:    { "image_url": "<signed https url>", "image_width": 3000, "image_height": 4000 }

200 →    {
           "model": "roboflow-holds", "model_version": "3",
           "latency_ms": 2840,
           "detections": [
             { "polygon": [[0.412,0.233],[0.431,0.229],...],   // normalized 0..1, ≥3 points
               "type": "crimp" | null,                          // null when model has no type head
               "confidence": 0.87 }
           ]
         }
4xx/5xx → { "error": "<code>", "message": "<human readable>" }

GET /healthz → 200 { "ok": true, "model": "...", "model_version": "..." }
```

### Model adapter interface (Python)

```python
class Detection(BaseModel):
    polygon: list[tuple[float, float]]   # normalized
    type: HoldType | None
    confidence: float

class HoldDetector(Protocol):
    name: str
    version: str
    def detect(self, image: Image.Image) -> list[Detection]: ...
```

- Implementations live in `services/ml/app/detectors/`; the active one is chosen by the `HOLD_DETECTOR` env var.
- Post-processing is shared and model-agnostic: confidence threshold (default 0.4), non-max suppression on overlapping polygons, polygon simplification (≤ 32 points), dropping detections smaller than a minimum area, and clamping to `0..1`.
- If a model returns boxes rather than masks, the adapter can turn them into outlines with SAM 2, prompting it with each box. This is a candidate pipeline for the spike.

## Data Model

```sql
create type detection_status as enum ('queued', 'running', 'succeeded', 'failed');

create table hold_detections (
  id             uuid primary key default gen_random_uuid(),
  layout_id      uuid not null references wall_layouts (id) on delete cascade,
  requested_by   uuid references profiles (id) on delete set null,
  status         detection_status not null default 'queued',
  model          text,
  model_version  text,
  latency_ms     integer,                 -- model time reported by the service
  total_ms       integer,                 -- request → holds written
  hold_count     integer,
  error_code     text,
  raw_output     jsonb,                   -- full service response, for evaluation
  created_at     timestamptz not null default now(),
  finished_at    timestamptz
);

alter table holds
  add constraint holds_detection_fk foreign key (detection_id) references hold_detections (id) on delete set null;

-- Per-detection outcome summary, filled when the layout is published.
create view detection_outcomes as
select d.id, d.model, d.model_version,
       count(h.*) filter (where h.source = 'detected'        and h.deleted_at is null) as kept,
       count(h.*) filter (where h.source = 'detected_edited' and h.deleted_at is null) as edited,
       count(h.*) filter (where h.detection_id = d.id        and h.deleted_at is not null) as rejected,
       count(m.*) as added_manually
from hold_detections d
left join holds h on h.detection_id = d.id
left join holds m on m.layout_id = d.layout_id and m.source = 'manual' and m.deleted_at is null
group by d.id;
```

- Moving, resizing, or retyping a detected hold sets `source = 'detected_edited'`; `detected_polygon` keeps the original proposal. This is handled in `walls`.
- Running detection again on a layout that already has proposals soft-deletes any proposals not yet accepted. Accepted and manual holds are kept.

### Row Level Security

| Table / view | Select | Insert / Update / Delete |
|---|---|---|
| `hold_detections` | `can_admin_wall` of the layout's wall | Edge Function (service role) only |
| `detection_outcomes` | service role only (builder analytics) | — |

## Evaluation (the spike)

Before wiring up the app, compare **at least two** candidate pipelines on a fixed evaluation set:

- **Eval set:** at least 10 real spray-wall photos in varied lighting, wall colours, and hold densities, with holds hand-labeled as polygons in the app's own editor and exported to `services/ml/eval/`.
- **Script:** `uv run python -m app.eval --detector <name>` reports precision, recall, and F1 at IoU ≥ 0.5, type accuracy (when the model gives types), and p50/p95 latency.
- **Result:** a short ADR in `docs/adr/0001-hold-detection-model.md` recording the scores, the chosen pipeline, the hosting decision, and the estimated cost per detection.

## Targets

| Metric | Target | Measured on |
|---|---|---|
| Recall (IoU ≥ 0.5) | ≥ 80% | eval set |
| Precision (IoU ≥ 0.5) | ≥ 75% | eval set |
| Time to finished wall | correcting a ~150-hold wall takes < 3 min | manual test, 3 walls |
| Latency (request → proposals visible) | p95 ≤ 15 s warm, ≤ 45 s cold start | staging |
| Cost | ≤ $0.05 per detection | provider pricing + measured runtime |

If no off-the-shelf pipeline reaches recall ≥ 80%, **ask first** before fine-tuning. Training a model is out of scope unless approved.

## Limits and safeguards

- Rate limit: 20 detections per user per day, 3 concurrent per user (Edge Function, Postgres-counted).
- Image size limit: 3000px long edge (enforced by `walls` upload); the service rejects larger than 4096px.
- Timeout: the Edge Function marks the job `failed` with `error_code = 'timeout'` after 90 s.
- Jobs stuck in `queued`/`running` for more than 5 minutes are marked failed by a scheduled cleanup (pg_cron).
- Logging: structured JSON logs in the ML service with detection id, model, latency, and detection count. No image content in logs.

## Commands (module-specific)

```bash
cd services/ml && uv run fastapi dev app/main.py           # local service on :8000
cd services/ml && uv run pytest                            # unit + contract tests
cd services/ml && uv run python -m app.eval --detector all # evaluation report
supabase functions serve detect-holds --env-file supabase/.env.local
```

## Acceptance Criteria

- [ ] Spike ADR exists with eval scores for at least two pipelines and the chosen hosting.
- [ ] Tapping "Detect holds" on a draft layout shows progress, then proposals in the editor, on both platforms.
- [ ] Proposals can be accepted (individually or all), edited, or deleted; edits set `detected_edited` and keep the original polygon.
- [ ] Failure and timeout show a retry option, and manual editing remains usable throughout.
- [ ] Non-admins of a wall cannot start detection or read its detection rows (proven by pgTAP and Deno tests).
- [ ] The rate limit returns a clear message once exceeded.
- [ ] The chosen pipeline meets the recall and precision targets on the eval set.
- [ ] Latency and cost targets are met in the deployed environment.
- [ ] `detection_outcomes` reports kept, edited, rejected, and manually added counts for real detections.

## Testing

- **pytest:** post-processing (thresholding, NMS, simplification, clamping) with fixture outputs; API contract tests with a fake detector; auth header rejection; oversized image rejection.
- **Deno:** `detect-holds` permission check, rate limit, job lifecycle (queued → succeeded/failed, timeout) with a mocked ML service.
- **pgTAP:** `hold_detections` RLS; `detection_outcomes` counts against fixture data.
- **Manual:** the 3-wall correction-time test; cold-start latency in the deployed environment.

## Out of Scope

- Training or fine-tuning models (unless approved after the spike).
- On-device inference.
- Automatic hold-type classification beyond what the chosen model returns.
- Detecting wall angle or perspective from the photo.
- Video or live camera detection.

## Decisions

- Spike candidates (resolved 2026-10-28): (a) a published climbing-hold segmentation model from Roboflow Universe via hosted inference, and (b) an open detector from Roboflow Universe plus SAM 2 for outlines, self-hosted. Check each model's license before use.
- Development budget ceiling for cloud inference: $10/month (default; ask first before exceeding it).
