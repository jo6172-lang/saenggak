'use strict';
/* 생각펼치기 — 시작 틀(템플릿). 내용은 모두 새로 쓴 예시 글이다. */
const TEMPLATES = [
  { id: 'blank', name: '빈 마인드맵', desc: '가운데 주제에서 생각을 자유롭게 펼쳐요', layout: 'mind', theme: 'bright',
    md: `# 가운데 주제\n## 생각 1\n## 생각 2\n## 생각 3\n## 생각 4` },
  { id: 'brainstorm', name: '버블 브레인스토밍', desc: '떠오르는 대로 둥글게 늘어놓아요', layout: 'bubble', theme: 'pastel',
    md: `# 아이디어\n## 누가?\n## 무엇을?\n## 언제?\n## 어디서?\n## 왜?\n## 어떻게?` },
  { id: 'study', name: '공부 정리', desc: '하나의 주제를 질문으로 나눠 정리해요', layout: 'right', theme: 'deep',
    md: `# 공부할 주제\n## 무엇인가?\n- 한 줄로 뜻 적기\n## 왜 중요한가?\n- 까닭 1\n- 까닭 2\n## 핵심 개념\n- 개념 1\n- 개념 2\n- 개념 3\n## 예시\n- 생활 속 예\n## 더 알아볼 것\n- 궁금한 점` },
  { id: 'lesson', name: '수업·학습 계획', desc: '목표부터 평가까지 한눈에', layout: 'mind', theme: 'bright',
    md: `# 수업 계획\n## 목표\n- 알게 될 것\n- 할 수 있게 될 것\n## 준비물\n- 자료\n- 도구\n## 활동\n- 생각 열기\n- 함께 해 보기\n- 혼자 해 보기\n## 평가\n- 확인 질문\n- 돌아보기\n## 참고 자료\n- 책\n- 영상` },
  { id: 'swot', name: 'SWOT 분석', desc: '강점·약점·기회·위협을 나눠 봐요', layout: 'mind', theme: 'deep',
    md: `# 분석할 대상\n## 강점 (S)\n- 잘하는 것\n- 남보다 나은 것\n## 약점 (W)\n- 부족한 것\n- 고칠 것\n## 기회 (O)\n- 바깥의 좋은 흐름\n## 위협 (T)\n- 바깥의 걱정거리` },
  { id: 'profile', name: '나를 소개해요', desc: '자기소개·포트폴리오 준비', layout: 'mind', theme: 'pastel',
    md: `# 나\n## 기본 정보\n- 이름\n- 하는 일\n## 좋아하는 것\n- 취미\n- 즐겨 보는 것\n## 잘하는 것\n- 재주 1\n- 재주 2\n## 걸어온 길\n- 배운 곳\n- 일한 곳\n## 앞으로의 꿈` },
  { id: 'plan', name: '사업·일 기획', desc: '목적에서 할 일까지 위에서 아래로', layout: 'org', theme: 'mono',
    md: `# 기획 이름\n## 목적\n- 누구를 돕나\n- 무엇이 나아지나\n## 할 일\n- 준비\n- 실행\n- 마무리\n## 일정\n- 시작\n- 중간 점검\n- 끝\n## 확인\n- 잘 됐는지 재는 법` },
  { id: 'org', name: '조직도', desc: '팀과 사람을 위에서 아래로', layout: 'org', theme: 'deep',
    md: `# 대표\n## 기획팀\n- 팀장\n- 팀원\n## 운영팀\n- 팀장\n- 팀원\n## 마케팅팀\n- 팀장\n- 팀원` },
  { id: 'week', name: '한 주 계획', desc: '요일별로 옆으로 이어서', layout: 'timeline', theme: 'bright',
    md: `# 이번 주\n## 월\n- 할 일\n## 화\n- 할 일\n## 수\n- 할 일\n## 목\n- 할 일\n## 금\n- 할 일` },
  { id: 'checklist', name: '할 일 목록', desc: '나무처럼 아래로 내려가는 목록', layout: 'tree', theme: 'mono',
    md: `# 해야 할 일\n## 오늘\n- 첫 번째 일\n- 두 번째 일\n## 이번 주\n- 큰 일 하나\n## 언젠가\n- 해 보고 싶은 일` },
];
