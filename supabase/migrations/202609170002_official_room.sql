insert into public.rooms(id, owner_id, kind, title)
values ('00000000-0000-4000-8000-000000000001', null, 'official', '상식방')
on conflict (id) do nothing;

insert into private.official_questions(id, prompt, choices, correct_choice, points, sort_order)
values
  ('10000000-0000-4000-8000-000000000001', '대한민국의 수도는 어디일까요?', array['부산', '서울', '대전', '인천'], 1, 100, 10),
  ('10000000-0000-4000-8000-000000000002', '물의 화학식은 무엇일까요?', array['CO₂', 'O₂', 'H₂O', 'NaCl'], 2, 100, 20),
  ('10000000-0000-4000-8000-000000000003', '지구가 태양을 한 바퀴 도는 데 걸리는 기간에 가장 가까운 것은?', array['24시간', '30일', '365일', '10년'], 2, 100, 30)
on conflict (id) do nothing;
