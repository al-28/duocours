create or replace function public.submit_learning_attempt(
  p_exercise_id uuid, p_answer jsonb, p_is_correct boolean, p_response_time_ms integer
)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_exercise public.exercises%rowtype;
  v_mastery_score numeric; v_attempts integer; v_correct integer;
  v_consecutive_wrong integer; v_needs_review boolean;
  v_actual_correct boolean; v_selected_index text; v_correct_index text;
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if p_response_time_ms is not null and (p_response_time_ms < 0 or p_response_time_ms > 3600000) then raise exception 'invalid_response_time'; end if;
  if p_answer is null or jsonb_typeof(p_answer) <> 'object' then raise exception 'invalid_answer'; end if;
  v_selected_index := p_answer->>'selected_index';
  select * into v_exercise from public.exercises where id = p_exercise_id;
  if not found then raise exception 'exercise_not_found'; end if;
  if v_selected_index is not null then
    if v_selected_index !~ '^[0-3]$' then raise exception 'invalid_answer'; end if;
    v_correct_index := v_exercise.answer->>'correct_index';
    if v_correct_index !~ '^[0-3]$' then raise exception 'invalid_stored_answer'; end if;
  end if;
  v_actual_correct := v_selected_index is not null and v_selected_index = v_correct_index;
  insert into public.learning_attempts(user_id, exercise_id, answer, is_correct, response_time_ms)
  values (v_user_id, p_exercise_id, p_answer, v_actual_correct, p_response_time_ms);
  if v_exercise.concept_id is not null then
    insert into public.concept_mastery(user_id, concept_id, score, attempts, correct_attempts, consecutive_wrong, needs_review, last_wrong_at, last_correct_at, last_attempt_at, updated_at)
    values (v_user_id, v_exercise.concept_id, case when v_actual_correct then 1 else 0 end, 1, case when v_actual_correct then 1 else 0 end, case when v_actual_correct then 0 else 1 end, not v_actual_correct, case when v_actual_correct then null else now() end, case when v_actual_correct then now() else null end, now(), now())
    on conflict (user_id, concept_id) do update set
      score = greatest(0, least(1, public.concept_mastery.score * 0.7 + case when v_actual_correct then 1 else 0 end * 0.3)),
      attempts = public.concept_mastery.attempts + 1,
      correct_attempts = public.concept_mastery.correct_attempts + case when v_actual_correct then 1 else 0 end,
      consecutive_wrong = case when v_actual_correct then 0 else public.concept_mastery.consecutive_wrong + 1 end,
      needs_review = case when v_actual_correct then greatest(0, least(1, public.concept_mastery.score * 0.7 + 0.3)) < 0.75 else true end,
      last_wrong_at = case when v_actual_correct then public.concept_mastery.last_wrong_at else now() end,
      last_correct_at = case when v_actual_correct then now() else public.concept_mastery.last_correct_at end,
      last_attempt_at = now(), updated_at = now();
    select score, attempts, correct_attempts, consecutive_wrong, needs_review into v_mastery_score, v_attempts, v_correct, v_consecutive_wrong, v_needs_review
    from public.concept_mastery where user_id = v_user_id and concept_id = v_exercise.concept_id;
  end if;
  return jsonb_build_object('is_correct', v_actual_correct, 'mastery_score', coalesce(v_mastery_score, 0), 'attempts', coalesce(v_attempts, 0), 'correct_attempts', coalesce(v_correct, 0), 'consecutive_wrong', coalesce(v_consecutive_wrong, 0), 'needs_review', coalesce(v_needs_review, false), 'concept_id', v_exercise.concept_id, 'explanation', v_exercise.explanation);
end; $function$;
revoke execute on function public.submit_learning_attempt(uuid, jsonb, boolean, integer) from public, anon;
grant execute on function public.submit_learning_attempt(uuid, jsonb, boolean, integer) to authenticated;
drop policy if exists "attempts_all" on public.learning_attempts;
create policy "attempts_select_own" on public.learning_attempts for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "mastery_all" on public.concept_mastery;
create policy "mastery_select_own" on public.concept_mastery for select to authenticated using ((select auth.uid()) = user_id);