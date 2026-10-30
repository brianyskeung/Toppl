begin;
select plan(1);
select has_extension('pgtap');
select * from finish();
rollback;
