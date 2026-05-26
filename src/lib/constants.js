export const SHEET_ID = '1fgq3zlrZYReidY5-0QFUht48mQBdctgEpYkE-xp5g3U';
export const MANAGERS = ['정제원', '송건희', '김대현', '전고은'];
export const APPLICANT_PLATFORMS = ['사람인', '잡코리아', '원티드', '리멤버', '알바몬', '지인소개'];
export const PROPOSAL_PLATFORMS = ['사람인', '잡코리아', '원티드', '리멤버', '알바몬'];
export const MANAGER_COLORS = { '정제원':'badge-primary','송건희':'badge-blue','김대현':'badge-purple','전고은':'badge-gold' };
export const PLATFORM_COLORS = { '사람인':'badge-error','잡코리아':'badge-blue','원티드':'badge-success','리멤버':'badge-primary','알바몬':'badge-orange','지인소개':'badge-gold' };
export const STATUS_COLORS = {
  '면접예정':'badge-blue','면접완료':'badge-primary','합격':'badge-success','불합격':'badge-gray','취소':'badge-warning',
  '입사 예정':'badge-blue','교육 중':'badge-warning','입사 완료':'badge-success','입사 취소':'badge-gray',
  '대기':'badge-gray','응답':'badge-success','미응답':'badge-warning','거절':'badge-error','면접진행':'badge-blue',
  '완료':'badge-success','미완료':'badge-warning','참석':'badge-success','불참':'badge-error',
};
export const CHART_COLORS = ['#01696f','#006494','#7a39bb','#d19900','#da7101','#a12c7b'];

export const DEFAULT_INTERVIEWS = [
  {id:1,name:'김민준',job:'마케터',type:'지원자',platform:'원티드',date:'2025-05-28',time:'14:00',manager:'송건희',status:'면접예정',memo:'포트폴리오 우수',interviewer:'',attendance:'',passed:'',guided:'',startDate:''},
  {id:2,name:'이서연',job:'영상편집자',type:'지원자',platform:'사람인',date:'2025-05-29',time:'11:00',manager:'김대현',status:'면접예정',memo:'',interviewer:'',attendance:'',passed:'',guided:'',startDate:''},
  {id:3,name:'최유진',job:'콘텐츠기획',type:'포지션 제안자',platform:'리멤버',date:'2025-05-27',time:'10:00',manager:'송건희',status:'면접완료',memo:'2차 면접 예정',interviewer:'',attendance:'',passed:'',guided:'',startDate:''},
];
export const DEFAULT_ONBOARDS = [
  {id:1,name:'오하늘',job:'그래픽디자이너',date:'2025-06-02',manager:'김대현',status:'입사 예정',attendance:'',emailCreated:'',flexJoined:'',contractSigned:'',memo:'비자 확인 필요'},
  {id:2,name:'나다운',job:'콘텐츠마케터',date:'2025-06-09',manager:'송건희',status:'입사 예정',attendance:'',emailCreated:'',flexJoined:'',contractSigned:'',memo:''},
];
export const DEFAULT_PROPOSALS = [
  {id:1,name:'한예진',job:'PD',platform:'리멤버',manager:'정제원',date:'2025-05-20',result:'응답',memo:'2차 연락 예정'},
  {id:2,name:'임도현',job:'영상편집자',platform:'원티드',manager:'김대현',date:'2025-05-21',result:'미응답',memo:''},
  {id:3,name:'신지수',job:'마케터',platform:'사람인',manager:'송건희',date:'2025-05-22',result:'대기',memo:''},
];
