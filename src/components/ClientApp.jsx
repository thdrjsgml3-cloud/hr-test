'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, useTransition } from 'react';
import { Chart, registerables } from 'chart.js';
import { LayoutDashboard, CalendarCheck, UserCheck, Send, Menu, Plus, Sun, Moon, Search, Settings, Receipt, FileText } from 'lucide-react';
import { STATUS_COLORS, CHART_COLORS, DEFAULT_INTERVIEWS, DEFAULT_ONBOARDS, DEFAULT_PROPOSALS } from '@/lib/constants';
import { today, getHighlightDate } from '@/lib/utils';
import { loadData, apiUpdate, apiAdd, apiInsert, apiDelete, apiSync, apiSaveAllJDs } from '@/lib/sheets';

Chart.register(...registerables);

// ── 월 관련 헬퍼 ──
function generateMonths() {
  const result = [];
  const now = new Date();
  let y = 2025, m = 5;
  while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
    result.push(`${y}-${String(m).padStart(2,'0')}`);
    if (++m > 12) { m = 1; y++; }
  }
  return result;
}
function fmtMonth(k) {
  if (!k || k === 'none') return '날짜 없음';
  const [y, m] = k.split('-');
  return `${y}년 ${parseInt(m)}월`;
}
function fmtMonthShort(k) {
  if (!k || k === 'none') return '-';
  const [y, m] = k.split('-');
  return `${String(y).slice(-2)}.${m}`;
}
function categorizeJob(job, settings) {
  if (!job) return '본사';
  if (settings.sales.some(k => job.includes(k))) return '영업';
  if (settings.fnb.some(k => job.includes(k))) return 'F&B';
  return '본사';
}

const DEFAULT_APP_SETTINGS = {
  sales: ['광고 영업', '광고영업'],
  fnb: ['육지', '교도리', '코브', '그랑디르', 'PZPZ'],
  managers: ['정제원', '송건희', '김대현', '전고은'],
  applicantPlatforms: ['사람인', '잡코리아', '원티드', '리멤버', '알바몬', '지인소개'],
  proposalPlatforms: ['사람인', '잡코리아', '원티드', '리멤버', '알바몬'],
  costVendors: ['사람인', '잡코리아', '원티드', '리멤버', '알바몬', '기타'],
  costNotes: ['퍼플페퍼', '땡큐'],
};

const JD_COMPANIES = ['본사', 'PZPZ', '교도리', '그랑디르', '광고영업'];

const DEFAULT_JDS = [
  { id:1,  company:'본사', division:'경영관리본부', team:'인사팀',     position:'공인노무사',            experienceLevel:'2년 이상',    status:'진행중',
    duties:'• 노동정책 변화에 따른 전략 수립 및 실행\n• 노동청, 노동위원회 등 진정사건/노동분쟁 대응 및 대관업무\n• 전사 노무 리스크 검토\n• 사내 노무 자문 및 기타 노무 이슈 대응\n• 4대보험 취득/상실 및 관리',
    requirements:'• 공인노무사 자격 보유하신 분\n• 유관 경력 2년이상 보유하신 분(노무법인, 법무법인, 기업체 등)',
    preferred:'• 인사노무 이슈 관련 문제 해결능력을 보유하신 분\n• 원만한 커뮤니케이션 능력을 보유하신 분\n• 기업 인사노무관리 전반에 대한 지식, 경험을 보유하신 분' },
  { id:2,  company:'본사', division:'경영관리본부', team:'재무회계팀',  position:'재무회계 담당자',        experienceLevel:'7년 이상',    status:'진행중',
    duties:'• 결산 총괄 및 재무보고 (월간, 분기, 연간 결산)\n• 재무제표 및 결산보고서 작성(K-GAAP)\n• 외부회계감사 대응\n• TAX - 부가가치세 신고 검토, 법인세 신고 및 세무조정\n• 자금 관리 - 일일 자금현황, 단기 자금계획\n• 지급 결의 승인 프로세스 운영\n• ERP 시스템 운영\n• 주니어 담당자 멘토링',
    requirements:'• 기업 재무/회계팀 실무 경력 7년 이상 (외부회계 감사 대응 경험 5회 이상)\n• K-GAAP 및 K-IFRS 기준 결산 업무 직접 수행 경험 (동일 기업 3년 이상)\n• 법인세 신고 업무 수행 경험\n• 능숙한 ERP 및 회계프로그램 사용 능력',
    preferred:'• 높은 수준의 수치 분석력 및 세밀함\n• 복잡한 회계 이슈에 대한 독립적 판단 및 문제해결 능력\n• 회사 내·외 이해관계자와의 원활한 커뮤니케이션 능력\n• 주니어 구성원에 대한 코칭 및 리더십 마인드' },
  { id:3,  company:'본사', division:'콘텐츠본부',   team:'마케팅팀',    position:'중화권 마케터',          experienceLevel:'경력 무관',   status:'진행중',
    duties:'• 중화권 시장 대상 디지털 마케팅 전략 수립 및 실행\n• 샤오홍슈, 도우인, 웨이보 등 중화권 SNS 채널 운영\n• 메이투안, 디엔핑 등 플랫폼 기반 마케팅 기획 및 관리\n• 중화권 인플루언서 및 MCN 협업 및 시딩 캠페인 운영\n• 중화권 현지 마케팅 에이전시 및 파트너사 커뮤니케이션',
    requirements:'• 중국어&한국어 커뮤니케이션 가능 (비즈니스 수준)\n• 중화권 SNS 및 디지털 플랫폼에 대한 이해\n• 인플루언서 마케팅 또는 디지털 마케팅 경험\n• 해외 시장 마케팅 또는 글로벌 마케팅 업무 경험',
    preferred:'• 샤오홍슈/도우인/웨이보 마케팅 운영 경험\n• 중국 또는 중화권 지역 거주 경험 또는 현지 네트워크\n• 중화권 인플루언서 및 MCN 협업 경험\n• 관광/뷰티/라이프스타일 산업 마케팅 경험' },
  { id:4,  company:'본사', division:'콘텐츠본부',   team:'마케팅팀',    position:'일본 마케터',            experienceLevel:'경력 무관',   status:'진행중',
    duties:'• 일본 시장 대상 디지털 마케팅 전략 수립 및 실행\n• 인스타그램, X(구 트위터), 유튜브 등 일본 SNS 채널 운영\n• 일본 인플루언서 협업 및 시딩 캠페인 운영\n• 일본 관광객 대상 콘텐츠 기획 및 마케팅 캠페인 실행\n• 일본 현지 마케팅 에이전시 및 파트너사 커뮤니케이션',
    requirements:'• 일본어 커뮤니케이션 가능 (비즈니스 수준)\n• 일본 SNS 및 디지털 플랫폼에 대한 이해\n• 인플루언서 마케팅 또는 디지털 마케팅 경험\n• 글로벌 마케팅 또는 해외 마케팅 경험',
    preferred:'• 일본 거주 경험 또는 일본 시장 마케팅 경험\n• 일본 인플루언서 및 크리에이터 네트워크\n• 일본 관광객 대상 마케팅 경험\n• 일본 플랫폼 기반 콘텐츠 마케팅 경험' },
  { id:5,  company:'본사', division:'콘텐츠본부',   team:'마케팅팀',    position:'영미권 마케터',          experienceLevel:'경력 무관',   status:'진행중',
    duties:'• 북미 및 영미권 시장 대상 디지털 마케팅 전략 수립 및 실행\n• 인스타그램, 틱톡, 유튜브 등 글로벌 SNS 채널 운영\n• 글로벌 인플루언서 협업 및 시딩 캠페인 운영\n• 영미권 타겟 콘텐츠 기획 및 마케팅 캠페인 실행',
    requirements:'• 영어 커뮤니케이션 가능 (비즈니스 수준)\n• 글로벌 SNS 및 디지털 플랫폼에 대한 이해\n• 인플루언서 마케팅 또는 디지털 마케팅 경험\n• 글로벌 마케팅 캠페인 운영 경험',
    preferred:'• 해외 거주 경험 또는 영미권 시장 마케팅 경험\n• 글로벌 인플루언서 협업 경험\n• 콘텐츠 마케팅 및 퍼포먼스 마케팅 경험\n• 관광/라이프스타일/뷰티 산업 마케팅 경험' },
  { id:6,  company:'본사', division:'콘텐츠본부',   team:'마케팅팀',    position:'동남아시아 마케터',      experienceLevel:'경력 무관',   status:'진행중',
    duties:'• 동남아시아 시장 대상 디지털 마케팅 전략 수립 및 실행\n• 틱톡, 인스타그램, 페이스북 등 SNS 채널 운영\n• 동남아시아 인플루언서 협업 및 시딩 캠페인 운영\n• 동남아 관광객 대상 콘텐츠 기획 및 마케팅 실행',
    requirements:'• 영어 커뮤니케이션 가능\n• 동남아 SNS 및 디지털 플랫폼 이해\n• 인플루언서 마케팅 또는 디지털 마케팅 경험\n• 글로벌 마케팅 또는 해외 마케팅 경험',
    preferred:'• 동남아시아 거주 경험 또는 시장 이해도\n• 현지 인플루언서 및 MCN 네트워크\n• 틱톡 기반 마케팅 경험\n• 관광/라이프스타일/뷰티 산업 마케팅 경험' },
  { id:7,  company:'본사', division:'콘텐츠본부',   team:'광고기획팀',  position:'콘텐츠 마케팅',          experienceLevel:'3년 이상',    status:'진행중',
    duties:'• 온라인 광고 콘텐츠 기획 및 제작\n• 클라이언트 및 내부 커뮤니케이션\n• 콘텐츠 매체 성과 분석 및 관리 (페이스북, 구글, GA4 등)\n• 제안 문서 및 보고서 작성',
    requirements:'• 관련 경력 3년 이상\n• SNS 채널 운영 경험\n• 트렌드에 민감하고 미디어 리터러시 역량 보유\n• 유튜브, 인스타그램 등 온라인 콘텐츠 이해도가 높은 분\n• MS Office 활용 가능',
    preferred:'• 유명 SNS 채널 혹은 유튜브 운영 경험, 음원/영화/드라마 등 경험\n• 데이터 분석 경험\n• 카피라이팅 능력 우수\n• 포토샵, 피그마 등 디자인 툴 활용 가능' },
  { id:8,  company:'본사', division:'콘텐츠본부',   team:'광고기획팀',  position:'바이럴 마케팅',          experienceLevel:'1년 이상',    status:'진행중',
    duties:'• 자사 및 클라이언트 브랜드의 바이럴 마케팅 전략 기획 및 실행\n• 맘카페, 지역·취미 카페, 각종 온라인 커뮤니티 침투형 바이럴 캠페인 운영\n• 게시글·댓글·후기·이슈/밈형 콘텐츠 기획 및 카피라이팅\n• 인플루언서·콘텐츠 마케터·퍼포먼스 마케터와의 협업\n• 바이럴 캠페인 성과 분석 및 인사이트 도출',
    requirements:'• 관련 경력 1년 이상\n• 온라인 마케팅/커뮤니티 운영 경험\n• 네이버 카페, 맘카페, 취미/덕질 커뮤니티에 대한 이해도 및 실제 이용 경험\n• 자연스러운 톤으로 설득하는 카피라이팅 역량\n• 트렌드 이슈, 밈, 유머 코드에 관심이 많은 분',
    preferred:'• 음원/영화/드라마 등 경험\n• 카페 침투, 커뮤니티 침투, 체험단 운영, 바이럴 대행사 근무 경험\n• 인플루언서 마케팅, SNS 채널 운영 경험\n• F&B 및 라이프스타일 분야 관심' },
  { id:9,  company:'본사', division:'콘텐츠본부',   team:'광고기획팀',  position:'광고기획/AE',            experienceLevel:'리더, 8년 이상', status:'진행중',
    duties:'• 마케팅 대행 조직 리드\n• 클라이언트 커뮤니케이션, 프로젝트 리드\n• 디지털 캠페인 전략 수립·기획·관리\n• 퍼포먼스 캠페인 전략 수립·기획·관리\n• 인플루언서 마케팅 기획·운영\n• 캠페인 성과 분석·개선\n• 제안서 작성, 경쟁 PT 참여\n• 이슈 및 리스크 관리',
    requirements:'• 8년 이상의 유관 경력\n• DA, SA, 퍼포먼스 전략 수립 경험\n• SNS 마케팅, 인플루언서 마케팅 경험\n• 제안서, 기획서 등 문서 작성 능력\n• 조직 관리 경험',
    preferred:'• 광고대행사 출신 우대\n• 앱·게임·커머스 등 다양한 카테고리 경험\n• MCN·인플루언서 협업 경험\n• AI 도구 활용 능력 우수' },
  { id:10, company:'본사', division:'콘텐츠본부',   team:'광고기획팀',  position:'퍼포먼스 마케팅',        experienceLevel:'6년 이상',    status:'진행중',
    duties:'• 마케팅 대행 조직 리드\n• 클라이언트 커뮤니케이션, 프로젝트 리드\n• 디지털/퍼포먼스 캠페인 전략 수립·기획·관리\n• 인플루언서 마케팅 기획·운영\n• 캠페인 성과 분석·개선\n• 제안서 작성, 경쟁 PT 참여',
    requirements:'• 6년 이상의 유관 경력\n• 주도적이며 능동적인 캠페인 운영 경험\n• DA, SA, 퍼포먼스 전략 수립 경험\n• 제안서, 기획서 등 문서 작성 능력',
    preferred:'• 광고대행사·퍼포먼스 대행사 출신 우대\n• 앱·게임·커머스 등 다양한 카테고리 경험\n• 미디어렙, 매체사, 플랫폼 커뮤니케이션 경험\n• AI 도구 활용 능력 우수' },
  { id:11, company:'본사', division:'콘텐츠본부',   team:'광고기획팀',  position:'광고 디자인',            experienceLevel:'6년 이상',    status:'진행중',
    duties:'• 마케팅 대행 조직 내 광고 소재 제작\n• DA 크리에이티브 기획·제작\n• 퍼포먼스 광고 소재 기획·제작\n• 소재 성과 데이터에 기반한 최적화\n• 캠페인 키비주얼 기획·제작\n• 신규 광고 포맷 및 트렌드 리서치',
    requirements:'• 6년 이상의 유관 경력\n• 포토샵, 일러스트레이터 활용 능력\n• 디지털 광고 환경에 대한 이해\n• DA·퍼포먼스 소재 제작 경험',
    preferred:'• 광고대행사·퍼포먼스 대행사 출신 우대\n• 앱·게임·커머스 등 다양한 카테고리 경험\n• 유튜브/SNS 콘텐츠 기획 경험\n• AI 도구 활용 능력 우수\n• 피그마 활용 능력 우수' },
  { id:12, company:'본사', division:'콘텐츠본부',   team:'영상팀',      position:'영상팀 총괄',            experienceLevel:'10년 이상',   status:'진행중',
    duties:'• 영상팀(숏폼 PD, 편집자, 작가 등) 총괄 및 리딩\n• 브랜드 중심 롱폼·숏폼 콘셉트 기획 및 콘텐츠 전략 수립\n• 인플루언서·연예인, 브랜드 모델 등 외부 파트너 출연 콘텐츠 기획 및 연출\n• 영상 톤앤매너 및 퀄리티 컨트롤, 사내외 프로덕션 협업 관리\n• 팀 내 제작 프로세스 개선 및 신규 포맷 개발 리딩',
    requirements:'• 관련 업계 경력 10년 이상\n• 프로덕션/방송사/유명 제작사 출신으로 실무 및 관리 경험이 풍부한 분\n• 영상 콘셉트 개발부터 기획서 제작, 촬영, 편집까지 전체 프로세스 이해도\n• 팀 단위 프로젝트 리딩 경험 (PD, 에디터, 작가로 구성된 제작팀 운영)\n• 포트폴리오 제출 필수 (본인 역할 명시 필수)',
    preferred:'• 유명 SNS 채널 혹은 유튜브 운영 경험, 음원/영화/드라마 등 경험\n• 브랜디드 콘텐츠, F&B, 인플루언서 협업 콘텐츠 제작 경험\n• 유튜브, 틱톡, 인스타그램 등 숏폼 플랫폼에 대한 높은 이해도\n• 카메라·조명 세팅 등 현장 연출 및 테크니컬 이해도' },
  { id:13, company:'본사', division:'콘텐츠본부',   team:'영상팀',      position:'인플루언서/연예인 PD',   experienceLevel:'3년 이상',    status:'진행중',
    duties:'• 인플루언서·연예인과 협업한 콘텐츠(롱폼·숏폼) 기획, 촬영, 편집 전반\n• 브랜드가 등장하는 롱폼 영상에서 숏폼화 가능한 구간 선별 및 스크립트 기획\n• 주목도를 높이는 오프닝 문장 및 후킹 포인트 기획\n• F&B 및 브랜드 홍보 주제의 숏폼 콘텐츠 제작 (릴스, 틱톡 등)\n• 편집자, 마케터 등 내부 협업을 통한 콘텐츠 제작 및 채널 운영 관리',
    requirements:'• 관련 업계 경력 3년 이상\n• 영상 포트폴리오(참여 역할 및 기여 부분 명시) 필수 제출\n• 콘텐츠 기획, 촬영, 편집 모두 수행 가능한 분\n• 인플루언서 또는 연예인 관련 콘텐츠 제작 경험',
    preferred:'• 음원/영화/드라마 등 경험\n• 포토샵·일러스트 등 디자인 툴 활용 가능\n• 영어 또는 제2외국어 활용 가능\n• 카메라, 조명 등 현장 촬영 장비 운용 가능\n• SNS 채널(유튜브, 인스타그램, 틱톡 등) 기획·운영 경험' },
  { id:14, company:'본사', division:'콘텐츠본부',   team:'영상팀',      position:'영상편집자',             experienceLevel:'3년 이하',    status:'진행중',
    duties:'• 숏폼(Shorts) 영상 편집 (광고형/밈형/브랜디드 콘텐츠 등)\n• 브랜드 계정 및 인플루언서 계정 영상 제작\n• 각 분야별 콘텐츠에 맞는 콘셉트 기획 및 편집\n• 트렌드 리서치 및 숏폼 포맷 기획 보조\n• 플랫폼별 규격에 맞춘 영상 최적화 및 업로드용 마스터 파일 제작',
    requirements:'• 숏폼 플랫폼(인스타, 유튜브, 틱톡) 콘텐츠에 대한 높은 이해도\n• 그래픽 활용 우수, 모션 관련 이해도 높은 분\n• 광고, 밈, 유행 포맷에 빠삭한 감각\n• Premiere Pro, After Effects 등 영상 편집 툴 능숙',
    preferred:'• 음원/영화/드라마 등 경험\n• 음원·뮤직비디오 편집, 영화 예고편/드라마 하이라이트 편집 경험\n• SNS 채널 운영 및 관리 경험\n• 디자인, 영상, 광고 등 관련 전공' },
  { id:15, company:'본사', division:'기술본부',     team:'PO팀',        position:'서비스 기획자',          experienceLevel:'4년 이상',    status:'진행중',
    duties:'• 신규 플랫폼 서비스 기획 및 전략 수립\n• GA4, GTM 기반의 데이터 수집 환경 설계 및 이벤트 택소노미 정의\n• 유저 행동 데이터 분석을 통한 퍼널 최적화 및 이탈률 개선\n• 정성/정량 데이터 기반 서비스 개선 가설 수립 및 검증 (A/B Test)\n• 사용자경험(UX)을 고려한 서비스 설계 및 개선\n• 서비스 개발, 런칭, 운영 로드맵 수립 및 일정 관리\n• Figma를 활용한 와이어프레임 및 프로토타입 제작',
    requirements:'• IT 서비스 기획 및 운영 분야 경력 6년 이상\n• GA, GTAG 등 데이터 기반 서비스 고도화 역량\n• 서비스 기획부터 출시, 운영까지 End to End 프로젝트 관리 경험\n• 뛰어난 리더십과 커뮤니케이션 역량',
    preferred:'• 맛집, 문화, 어플, 리워드 관련 서비스 기획 경험\n• 스타트업 또는 신규 서비스 런칭 경험\n• 프로젝트 관리 툴(JIRA, Confluence, Trello, Notion) 활용 가능\n• UI/UX 툴(Figma, Sketch, XD) 사용 경험' },
  { id:16, company:'본사', division:'기술본부',     team:'기술팀',      position:'백엔드 AI 개발자',       experienceLevel:'3년 이상',    status:'진행중',
    duties:'• 신규 AI 서비스 개발 및 외부 연동 시스템 설계 및 구축\n• 외부 플랫폼 연동 엔진 설계 및 차단 우회 전략 수립\n• 메시지 큐를 활용한 대용량 데이터 동기화 파이프라인 최적화\n• 정성적 데이터를 기반으로 프롬프트 엔지니어링 및 A/B Test',
    requirements:'• 백엔드 개발 및 시스템 운영 분야 경력 5년 이상\n• OpenAI API 또는 AI Agent 시스템 연동 경험\n• 외부 사이트 스크래핑 연동 역량\n• 기획부터 출시, 운영까지 End to End 프로젝트 경험',
    preferred:'• 푸드테크 관련 서비스 개발 및 운영 경험\n• 모노레포(Turborepo) 환경에서의 개발 및 코드 리뷰 경험\n• 프로젝트 관리 툴(Notion, Slack) 활용 가능\n• 커머스 프로젝트 경험' },
  { id:17, company:'본사', division:'기술본부',     team:'기술팀',      position:'프론트엔드 AI 개발자',   experienceLevel:'3년 이상',    status:'진행중',
    duties:'• 신규 AI 서비스 및 대시보드 UI/UX 설계 및 구현\n• React Query 기반의 서버 상태 관리 및 대량 데이터 무한 스크롤 최적화\n• Recharts를 활용한 복합 매출 추이 차트 및 인사이트 시각화 구현\n• 기존 모노레포 내 packages/ui 공통 컴포넌트 활용 및 라이브러리 고도화\n• Figma를 활용한 와이어프레임 기반의 반응형 웹 구현',
    requirements:'• 프론트엔드 개발 경력 3년 이상\n• React·Native 개발 역량\n• Next.js(App Router) 및 TypeScript를 이용한 서비스 고도화 역량\n• 디자인 시스템 가이드 준수 및 컴포넌트 단위 개발 경험\n• 원활한 협업 및 논리적 커뮤니케이션 역량',
    preferred:'• 스타트업 또는 신규 서비스 런칭 경험\n• 금융, 대시보드, 분석 툴 관련 서비스 기획 및 개발 경험\n• Tailwind CSS 및 모던 UI 프레임워크 활용 능력 우수\n• UI/UX 툴(Figma) 사용 및 디자인 시스템 구축 경험' },
  { id:18, company:'PZPZ', division:'PZPZ',        team:'-',           position:'피자 파트',             experienceLevel:'1년 이상',    status:'진행중',
    duties:'• 피자 도우 준비 및 토핑 세팅 등 기본 제조 업무 수행\n• 레시피 및 조리 매뉴얼에 따른 피자 조리 보조\n• 식재료 전처리 및 위생 관리\n• 주방 청결 유지 및 정리정돈\n• 피크타임 조리 지원 및 원활한 서비스 제공',
    requirements:'• 경력 1년 이상 (신입 지원 가능)\n• 피자 또는 양식 주방 경험자 우대\n• 기본적인 조리 스킬 보유자\n• 매뉴얼에 따른 정확한 업무 수행 가능한 분\n• 팀워크를 중시하며 성실하게 근무 가능한 분',
    preferred:'' },
  { id:19, company:'PZPZ', division:'PZPZ',        team:'-',           position:'콜드&핫 파트',          experienceLevel:'1년 이상',    status:'진행중',
    duties:'• 파트별(콜드/핫) 메뉴 조리 및 준비 업무 수행\n• 식재료 전처리 및 기본 조리 업무\n• 조리 매뉴얼 준수 및 품질 유지\n• 피크타임 조리 지원 및 서비스 속도 유지\n• 주방 청결 관리 및 위생 기준 준수',
    requirements:'• 경력 1년 이상 (신입 지원 가능)\n• 양식 조리 경험자 우대\n• 기본 조리 기술 및 위생 개념 보유\n• 책임감 있고 협업이 원활한 분',
    preferred:'' },
  { id:20, company:'PZPZ', division:'PZPZ',        team:'-',           position:'홀 파트',               experienceLevel:'경력무관',    status:'진행중',
    duties:'• 고객 응대 및 기본 서비스 제공\n• 주문 접수 및 POS 사용\n• 음식 서빙 및 테이블 세팅·정리\n• 매장 청결 유지\n• 피크타임 현장 지원 및 서비스 품질 유지',
    requirements:'• 경력 무관 (경험자 우대)\n• 외식업 서비스 경험자 우대\n• 밝고 친절한 서비스 마인드\n• 주말 및 피크타임 근무 가능자',
    preferred:'' },
  { id:21, company:'교도리', division:'교도리',     team:'-',           position:'주방 사원',             experienceLevel:'1년 이상',    status:'진행중',
    duties:'• 매장 운영 전반 학습\n• 메뉴 제조 및 고객 응대\n• 매장 정리 및 청소\n• 오더 정확도 체크 및 매장 청결\n• CS 표준 매뉴얼 준수\n• 개인 위생 준수',
    requirements:'• 주방/홀 R&R 업무 수행 1년 이상 필수',
    preferred:'' },
  { id:22, company:'교도리', division:'교도리',     team:'-',           position:'주방 아르바이트',       experienceLevel:'경력 무관',   status:'진행중',
    duties:'• 고객응대\n• 간단한 조리 및 서비스 보조\n• 매장 정리 및 청소\n• 담당 시간대 내 서비스 품질 유지\n• 개인 위생 준수',
    requirements:'• 신입/파트타이머 가능',
    preferred:'' },
  { id:23, company:'광고영업', division:'광고영업', team:'-',           position:'광고영업담당',          experienceLevel:'-',           status:'마감',
    duties:'• 광고 수주 및 제안\n• 신규 광고주 발굴 및 컨택\n• 유선 및 미팅을 통한 광고제안 및 계약 체결\n• 광고주 커뮤니케이션',
    requirements:'',
    preferred:'' },
  { id:24, company:'광고영업', division:'광고영업', team:'-',           position:'TM 아웃바운드',         experienceLevel:'-',           status:'마감',
    duties:'• 광고 제안 아웃바운드',
    requirements:'',
    preferred:'' },
];

function fmtAmount(n) {
  if (!n) return '0원';
  return Number(n).toLocaleString('ko-KR') + '원';
}

function groupByMonth(rows) {
  const groups = {};
  rows.forEach(r => { const k = r.date?.slice(0,7)||'none'; (groups[k]=groups[k]||[]).push(r); });
  return Object.entries(groups).sort((a,b) => b[0]==='none'?-1 : a[0]==='none'?1 : b[0].localeCompare(a[0]));
}

/* ── Badge ── */
function Badge({ text, cls }) {
  return <span className={`badge ${cls || STATUS_COLORS[text] || 'badge-gray'}`}>{text}</span>;
}

/* ── Inline text input (uncontrolled → saves on blur only) ── */
function InlineText({ value, onSave, placeholder }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && ref.current !== document.activeElement) ref.current.value = value || ''; }, [value]);
  return <input ref={ref} className="inline-input" defaultValue={value || ''} placeholder={placeholder || '-'} onBlur={e => onSave(e.target.value)} />;
}

/* ── 금액 입력 (실시간 세자리 쉼표) ── */
function AmountInput({ value, onSave }) {
  const ref = useRef(null);
  const fmt = n => (n ? Number(n).toLocaleString('ko-KR') : '');
  useEffect(() => { if (ref.current && ref.current !== document.activeElement) ref.current.value = fmt(value); }, [value]);
  return (
    <input ref={ref} className="inline-input" style={{textAlign:'right'}}
      defaultValue={fmt(value)} placeholder="0"
      onFocus={e => { e.target.value = value ? String(value) : ''; e.target.select(); }}
      onInput={e => { const d = e.target.value.replace(/[^0-9]/g,''); e.target.value = d ? Number(d).toLocaleString('ko-KR') : ''; }}
      onBlur={e => { const n = Number(e.target.value.replace(/[^0-9]/g,''))||0; onSave(n); e.target.value = fmt(n); }}
    />
  );
}

/* ── 날짜 입력 (텍스트, 포커스 시 전체 선택 → 연도 입력하면 월/일 초기화 없이 덮어씀) ── */
function DateInput({ value, onSave }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && ref.current !== document.activeElement) ref.current.value = value || ''; }, [value]);
  return (
    <input ref={ref} className="inline-input" defaultValue={value||''} placeholder="YYYY-MM-DD" maxLength={10}
      onFocus={e => e.target.select()}
      onBlur={e => {
        const v = e.target.value.trim();
        if (!v || /^\d{4}-\d{2}-\d{2}$/.test(v)) { onSave(v); }
        else { e.target.value = value || ''; }
      }}
    />
  );
}

/* ── 열 너비 드래그 조정 ── */
function useColResize(init) {
  const tbRef = useRef(null);
  const saved = useRef([...init]);
  const totalW = () => saved.current.reduce((a,b)=>a+b,0);
  useEffect(() => { if (tbRef.current) tbRef.current.style.width = totalW()+'px'; }, []);
  const grab = useCallback((idx, e) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = saved.current[idx];
    const mv = ev => {
      const w = Math.max(32, w0 + ev.clientX - x0);
      saved.current[idx] = w;
      const table = tbRef.current;
      if (!table) return;
      const col = table.querySelectorAll('col')[idx];
      if (col) col.style.width = w + 'px';
      table.style.width = totalW() + 'px';
    };
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', mv);
    document.addEventListener('mouseup', up);
  }, []);
  return { tbRef, grab, init };
}

/* ── Chart wrapper ── */
function ChartBox({ type, data, options, onChartClick }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();
    const mergedOptions = onChartClick
      ? { ...options, onClick: (_, elements) => { if (elements.length > 0) onChartClick(elements[0].index); } }
      : options;
    chartRef.current = new Chart(canvasRef.current, { type, data, options: mergedOptions });
    return () => chartRef.current?.destroy();
  });
  return <div className="chart-canvas-wrap"><canvas ref={canvasRef} /></div>;
}

/* ═══════════════════════════════════════════
   DASHBOARD PAGE
═══════════════════════════════════════════ */
const ALL_MONTHS = generateMonths();

const DashboardPage = React.memo(function DashboardPage({ interviews, onboards, proposals, costs, sheetStatus, theme, appSettings, onNavigate }) {
  const isDark = theme === 'dark';
  const textColor = isDark ? '#888785' : '#6b6b6b';
  const borderColor = isDark ? '#1c1b19' : '#ffffff';
  const gridColor = isDark ? '#2a2927' : '#eee';

  // 부서 필터
  const [deptFilter, setDeptFilter] = useState('전체');
  // 월 필터
  const [selMonths, setSelMonths] = useState(() => new Set(ALL_MONTHS));
  const toggleMonth = m => setSelMonths(p => { const n=new Set(p); n.has(m)?n.delete(m):n.add(m); return n; });
  const toggleAll = () => setSelMonths(p => p.size===ALL_MONTHS.length ? new Set() : new Set(ALL_MONTHS));

  const applyFilters = useCallback((rows) => {
    let r = deptFilter === '전체' ? rows : rows.filter(row => categorizeJob(row.job, appSettings) === deptFilter);
    return r.filter(row => row.date && selMonths.has(row.date.slice(0,7)));
  }, [deptFilter, appSettings, selMonths]);

  const fi = useMemo(() => applyFilters(interviews), [interviews, applyFilters]);
  const fo = useMemo(() => applyFilters(onboards), [onboards, applyFilters]);
  const fp = useMemo(() => applyFilters(proposals), [proposals, applyFilters]);
  const fc = useMemo(() => costs.filter(r => r.date && selMonths.has(r.date.slice(0,7))), [costs, selMonths]);

  // 채용 퍼넬 (KPI에서도 사용)
  const pct = (a,b) => b ? Math.round(a/b*100) : 0;
  const totalInt = fi.length;
  const attended = fi.filter(r=>r.attendance==='참석').length;
  const passed   = fi.filter(r=>r.passed==='합격').length;
  const failed   = fi.filter(r=>r.passed==='불합격').length;
  const iNames = new Set(fi.map(r=>r.name).filter(Boolean));
  const finalHired = fo.filter(r=>r.name && iNames.has(r.name)).length;

  // 비용
  const totalCost = fc.reduce((s,r) => s+(Number(r.amount)||0), 0);
  const costPerHire = finalHired > 0 ? Math.round(totalCost/finalHired) : 0;
  const vendorCosts = {};
  fc.forEach(r => { if(r.vendor) vendorCosts[r.vendor] = (vendorCosts[r.vendor]||0)+(Number(r.amount)||0); });

  const responded = fp.filter(r=>r.result==='수락'||r.result==='거절').length;
  const accepted  = fp.filter(r=>r.result==='수락').length;
  const kpis = [
    { label:'면접자',     value:`${fi.length}명`,  sub:'선택 기간 면접', color:'var(--color-blue-light)',    ic:'var(--color-blue)' },
    { label:'입사 예정',  value:`${fo.length}명`,  sub:'교육/입사 예정', color:'var(--color-success-light)', ic:'var(--color-success)' },
    { label:'포지션 제안',value:`${fp.length}건`,  sub:'총 발송',        color:'var(--color-primary-light)', ic:'var(--color-primary)' },
    { label:'제안 응답률',value:fp.length?`${responded} (${Math.round(responded/fp.length*100)}%)`:'0 (0%)', sub:'수락+거절 응답', color:'var(--color-gold-light)',   ic:'var(--color-gold)' },
    { label:'제안 수락률',value:fp.length?`${accepted} (${Math.round(accepted/fp.length*100)}%)`:'0 (0%)',   sub:'수락 인원',     color:'var(--color-orange-light)', ic:'var(--color-orange)' },
    { label:'면접 합격',  value:`${passed}명`, sub:'합격자 수', color:'var(--color-success-light)', ic:'var(--color-success)' },
    { label:'최종 입사율',value:`${finalHired}명 (${pct(finalHired,totalInt)}%)`, sub:'면접자 → 최종입사', color:'var(--color-purple-light)', ic:'var(--color-purple)' },
  ];

  // 면접 플랫폼별 (알려진 플랫폼만 집계 — 대면/화상 등 제외)
  const platCounts = {};
  appSettings.applicantPlatforms.forEach(p => { platCounts[p] = 0; });
  fi.forEach(r => { if(r.platform && Object.prototype.hasOwnProperty.call(platCounts, r.platform)) platCounts[r.platform]++; });
  const platLabels = appSettings.applicantPlatforms.filter(k => platCounts[k] > 0);
  const platTotal = platLabels.reduce((s,k) => s + platCounts[k], 0);

  // 포지션 제안 플랫폼별
  const ppCounts = {};
  appSettings.proposalPlatforms.forEach(p => ppCounts[p]=0);
  fp.forEach(r => { if(ppCounts[r.platform]!=null) ppCounts[r.platform]++; });
  const ppLabels = appSettings.proposalPlatforms.filter(k=>ppCounts[k]>0);
  const ppTotal = ppLabels.reduce((s,k) => s + ppCounts[k], 0);

  // 담당자별 포지션 제안 횟수
  const mgrPropCounts = {};
  appSettings.managers.forEach(m => mgrPropCounts[m]=0);
  fp.forEach(r => { if(mgrPropCounts[r.manager]!=null) mgrPropCounts[r.manager]++; });

  const scaleOpts = { y:{beginAtZero:true,ticks:{stepSize:1,color:textColor},grid:{color:gridColor}}, x:{ticks:{color:textColor},grid:{display:false}} };
  const empty1 = platLabels.length===0, empty2 = ppLabels.length===0;

  return (
    <div>
      <div className="page-header"><div><div className="page-title">채용 현황 대시보드</div><div className="page-desc">월을 클릭하면 해당 기간 데이터만 반영됩니다</div></div></div>
      {sheetStatus && <div className={`sheet-status ${sheetStatus.level}`}>{sheetStatus.msg}</div>}

      {/* 부서 필터 */}
      <div className="dept-filter-bar">
        {['전체','본사','영업','F&B'].map(d=>(
          <button key={d} className={`dept-btn${deptFilter===d?' active':''}`} onClick={()=>setDeptFilter(d)}>{d}</button>
        ))}
      </div>

      {/* 월 필터 */}
      <div className="card" style={{marginBottom:16,padding:'12px 16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <span style={{fontSize:'var(--text-sm)',fontWeight:600,color:'var(--color-text-muted)'}}>기간 선택</span>
          <button className="btn btn-secondary" style={{fontSize:11,padding:'2px 8px'}} onClick={toggleAll}>
            {selMonths.size===ALL_MONTHS.length?'전체 해제':'전체 선택'}
          </button>
          <span style={{fontSize:11,color:'var(--color-text-faint)'}}>({selMonths.size}개월 선택)</span>
        </div>
        <div className="month-filter-bar">
          {ALL_MONTHS.map(m=>(
            <button key={m} className={`month-btn${selMonths.has(m)?' active':''}`} onClick={()=>toggleMonth(m)}>{fmtMonthShort(m)}</button>
          ))}
        </div>
      </div>

      <div className="kpi-grid">
        {kpis.map(k=>(
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}<span className="kpi-icon" style={{background:k.color,color:k.ic,float:'right'}}/></div>
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-title">면접 대상자 플랫폼별 현황</div>
          {empty1
            ? <div style={{textAlign:'center',color:'var(--color-text-faint)',padding:'32px 0',fontSize:'var(--text-sm)'}}>데이터 없음</div>
            : <>
                <ChartBox type="doughnut" data={{labels:platLabels,datasets:[{data:platLabels.map(k=>platCounts[k]),backgroundColor:CHART_COLORS,borderWidth:2,borderColor}]}} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}} onChartClick={(idx)=>onNavigate('interview',{platform:platLabels[idx]})}/>
                <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:5}}>
                  {platLabels.map((k,i)=>(
                    <div key={k} onClick={()=>onNavigate('interview',{platform:k})} style={{display:'flex',alignItems:'center',gap:8,fontSize:'var(--text-sm)',cursor:'pointer',borderRadius:4,padding:'2px 4px',transition:'background 0.15s'}} onMouseEnter={e=>e.currentTarget.style.background='var(--color-surface-offset)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div style={{width:10,height:10,borderRadius:'50%',background:CHART_COLORS[i%CHART_COLORS.length],flexShrink:0}}/>
                      <span style={{flex:1}}>{k}</span>
                      <span style={{fontWeight:600}}>{platCounts[k]}건</span>
                      <span style={{color:'var(--color-text-muted)',minWidth:40,textAlign:'right'}}>{pct(platCounts[k],platTotal)}%</span>
                    </div>
                  ))}
                  <div style={{borderTop:'1px solid var(--color-divider)',marginTop:2,paddingTop:4,display:'flex',justifyContent:'space-between',fontSize:'var(--text-xs)',color:'var(--color-text-muted)'}}>
                    <span>합계</span><span style={{fontWeight:600}}>{platTotal}건</span>
                  </div>
                </div>
              </>
          }
        </div>
        <div className="chart-card">
          <div className="chart-title">포지션 제안 플랫폼별 현황</div>
          {empty2
            ? <div style={{textAlign:'center',color:'var(--color-text-faint)',padding:'32px 0',fontSize:'var(--text-sm)'}}>데이터 없음</div>
            : <>
                <ChartBox type="doughnut" data={{labels:ppLabels,datasets:[{data:ppLabels.map(k=>ppCounts[k]),backgroundColor:CHART_COLORS,borderWidth:2,borderColor}]}} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}} onChartClick={(idx)=>onNavigate('proposal',{platform:ppLabels[idx]})}/>
                <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:5}}>
                  {ppLabels.map((k,i)=>(
                    <div key={k} onClick={()=>onNavigate('proposal',{platform:k})} style={{display:'flex',alignItems:'center',gap:8,fontSize:'var(--text-sm)',cursor:'pointer',borderRadius:4,padding:'2px 4px',transition:'background 0.15s'}} onMouseEnter={e=>e.currentTarget.style.background='var(--color-surface-offset)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div style={{width:10,height:10,borderRadius:'50%',background:CHART_COLORS[i%CHART_COLORS.length],flexShrink:0}}/>
                      <span style={{flex:1}}>{k}</span>
                      <span style={{fontWeight:600}}>{ppCounts[k]}건</span>
                      <span style={{color:'var(--color-text-muted)',minWidth:40,textAlign:'right'}}>{pct(ppCounts[k],ppTotal)}%</span>
                    </div>
                  ))}
                  <div style={{borderTop:'1px solid var(--color-divider)',marginTop:2,paddingTop:4,display:'flex',justifyContent:'space-between',fontSize:'var(--text-xs)',color:'var(--color-text-muted)'}}>
                    <span>합계</span><span style={{fontWeight:600}}>{ppTotal}건</span>
                  </div>
                </div>
              </>
          }
        </div>
        <div className="chart-card">
          <div className="chart-title">담당자별 포지션 제안 횟수</div>
          <ChartBox type="bar" data={{labels:Object.keys(mgrPropCounts),datasets:[{data:Object.values(mgrPropCounts),backgroundColor:CHART_COLORS.slice(0,4),borderRadius:6,borderWidth:0}]}} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:scaleOpts}} onChartClick={(idx)=>onNavigate('proposal',{manager:Object.keys(mgrPropCounts)[idx]})}/>
        </div>
        <div className="chart-card">
          <div className="chart-title">채용 현황</div>
          <div className="funnel-grid">
            {[
              {label:'면접자',    val:totalInt,   base:totalInt,  color:'var(--color-blue)',    nav:()=>onNavigate('interview',{})},
              {label:'면접 참여', val:attended,   base:totalInt,  color:'var(--color-primary)', nav:()=>onNavigate('interview',{attendance:'참석'})},
              {label:'합격',      val:passed,     base:attended,  color:'var(--color-success)', nav:()=>onNavigate('interview',{passed:'합격'})},
              {label:'불합격',    val:failed,     base:attended,  color:'var(--color-error)',   nav:()=>onNavigate('interview',{passed:'불합격'})},
              {label:'최종 입사', val:finalHired, base:passed,    color:'var(--color-gold)',    nav:()=>onNavigate('onboard',{})},
            ].map(item=>(
              <div key={item.label} className="funnel-item" onClick={item.nav} style={{cursor:'pointer',borderRadius:6,padding:'4px',transition:'background 0.15s'}} onMouseEnter={e=>e.currentTarget.style.background='var(--color-surface-offset)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div className="funnel-label">{item.label}</div>
                <div className="funnel-bar-wrap"><div className="funnel-bar-fill" style={{width:pct(item.val,item.base)+'%',background:item.color}}/></div>
                <div className="funnel-stats">{item.val}명 <span className="funnel-pct">({pct(item.val,item.base)}%)</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 채용 비용 */}
      <div className="chart-card" style={{marginTop:'var(--space-5)'}}>
        <div className="chart-title">채용 비용 현황</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
          <div className="kpi-card">
            <div className="kpi-label">총 채용 비용</div>
            <div className="kpi-value" style={{fontSize:'var(--text-lg)'}}>{fmtAmount(totalCost)}</div>
            <div className="kpi-sub">선택 기간 합계</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">1인당 채용 비용</div>
            <div className="kpi-value" style={{fontSize:'var(--text-lg)'}}>{finalHired > 0 ? fmtAmount(costPerHire) : '-'}</div>
            <div className="kpi-sub">비용 ÷ 최종 입사자 {finalHired}명</div>
          </div>
        </div>
        {Object.keys(vendorCosts).length > 0
          ? <ChartBox type="bar"
              data={{labels:Object.keys(vendorCosts),datasets:[{data:Object.values(vendorCosts),backgroundColor:CHART_COLORS.slice(0,Object.keys(vendorCosts).length),borderRadius:6,borderWidth:0}]}}
              options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{color:textColor,callback:v=>v>=10000?(v/10000).toFixed(0)+'만':v},grid:{color:gridColor}},x:{ticks:{color:textColor},grid:{display:false}}}}}
            />
          : <div style={{textAlign:'center',color:'var(--color-text-faint)',fontSize:'var(--text-sm)',padding:'32px 0'}}>채용 비용 탭에서 비용을 입력하면 여기에 표시됩니다</div>
        }
      </div>

    </div>
  );
});

/* ═══════════════════════════════════════════
   INTERVIEW PAGE
═══════════════════════════════════════════ */
const InterviewPage = React.memo(function InterviewPage({ data, filter, setFilter, onUpdate, onUpdateType, onAdd, onShowMenu, appSettings }) {
  const [typeTab, setTypeTab] = useState('');
  const [collapsed, setCollapsed] = useState(new Set());
  const initDoneI = useRef(false);
  useEffect(() => {
    if (initDoneI.current || data.length === 0) return;
    initDoneI.current = true;
    const months = [...new Set(data.map(r => r.date?.slice(0,7)||'none'))];
    months.sort((a,b) => b==='none'?1:a==='none'?-1:b.localeCompare(a));
    const latest = months.find(m => m !== 'none');
    setCollapsed(new Set(months.filter(m => m !== latest)));
  }, [data]);
  const toggleM = m => setCollapsed(p => { const n=new Set(p); n.has(m)?n.delete(m):n.add(m); return n; });
  const { tbRef: iTbRef, grab: iGrab, init: iW } = useColResize([28,130,120,160,105,100,118,112,110,88,76,72,80,118,120]);

  const filtered = useMemo(() =>
    data.filter(r =>
      (!filter.search || r.name.toLowerCase().includes(filter.search) || r.job.toLowerCase().includes(filter.search)) &&
      (!filter.manager || r.manager === filter.manager) &&
      (!filter.platform || r.platform === filter.platform) &&
      (!filter.attendance || r.attendance === filter.attendance) &&
      (!filter.passed || r.passed === filter.passed) &&
      (!typeTab || r.type === typeTab)
    ).sort((a,b) => b.date.localeCompare(a.date)),
    [data, filter, typeTab]
  );
  const hl = getHighlightDate(filtered);
  const hasActiveFilter = filter.platform || filter.attendance || filter.passed || filter.manager || filter.search;

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">면접 일정</div><div className="page-desc">면접 예정자 목록 및 일정 관리</div></div>
        <button className="btn btn-primary" onClick={onAdd}><Plus size={14}/> 행 추가</button>
      </div>
      <div className="tabs">
        {[['','전체'],['지원자','지원자'],['포지션 제안자','포지션 제안자']].map(([v,label]) => (
          <button key={v} className={`tab-btn ${typeTab===v?'active':''}`} onClick={()=>setTypeTab(v)}>{label}</button>
        ))}
      </div>
      <div className="table-toolbar">
        <div className="search-wrap"><Search size={14}/>
          <input className="search-input" placeholder="이름 검색..." value={filter.search} onChange={e=>setFilter(f=>({...f,search:e.target.value.toLowerCase()}))}/>
        </div>
        <span className="filter-label">담당자</span>
        <select className="filter-select" value={filter.manager} onChange={e=>setFilter(f=>({...f,manager:e.target.value}))}>
          <option value="">전체</option>{appSettings.managers.map(m=><option key={m}>{m}</option>)}
        </select>
        <span className="filter-label">플랫폼</span>
        <select className="filter-select" value={filter.platform||''} onChange={e=>setFilter(f=>({...f,platform:e.target.value}))}>
          <option value="">전체</option>{appSettings.applicantPlatforms.map(p=><option key={p}>{p}</option>)}
        </select>
        <span className="filter-label">참석</span>
        <select className="filter-select" value={filter.attendance||''} onChange={e=>setFilter(f=>({...f,attendance:e.target.value}))}>
          <option value="">전체</option><option>참석</option><option>참석확인</option><option>불참</option><option>확인중</option>
        </select>
        <span className="filter-label">합격</span>
        <select className="filter-select" value={filter.passed||''} onChange={e=>setFilter(f=>({...f,passed:e.target.value}))}>
          <option value="">전체</option><option>합격</option><option>불합격</option>
        </select>
        {hasActiveFilter && (
          <button className="btn btn-secondary" style={{marginLeft:4}} onClick={()=>setFilter({search:'',manager:'',platform:'',attendance:'',passed:''})}>필터 초기화</button>
        )}
      </div>
      <div className="table-wrap">
        <table ref={iTbRef} className="data-table" style={{tableLayout:'fixed'}}>
          <colgroup>{iW.map((w,i)=><col key={i} style={{width:w}}/>)}</colgroup>
          <thead><tr>
            <th/>
            {['이름','연락처','직무','유형','플랫폼','면접일','면접시간','면접관','담당자','참석여부','합격여부','안내여부','입사예정일','비고'].map((h,i)=>(
              <th key={h}>{h}<span className="col-rsz" onMouseDown={e=>iGrab(i+1,e)}/></th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={14}><div className="empty-state"><p>등록된 면접 일정이 없습니다</p></div></td></tr>
              : groupByMonth(filtered).map(([month, rows]) => (
                <React.Fragment key={month}>
                  <tr className="month-group-header" onClick={()=>toggleM(month)}>
                    <td colSpan={15} style={{padding:'7px 12px'}}>
                      {collapsed.has(month)?'▶ ':'▼ '}{fmtMonth(month)}
                      <span style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:'normal',marginLeft:8}}>{rows.length}건</span>
                    </td>
                  </tr>
                  {!collapsed.has(month) && rows.map(r => {
                    const plats = r.type==='포지션 제안자' ? appSettings.proposalPlatforms : appSettings.applicantPlatforms;
                    return (
                      <tr key={r.id} className={r.date===hl?'row-today':''}>
                        <td className="row-handle-cell"><div className="row-handle-dot" onMouseEnter={e=>onShowMenu(e,r.id,'interview')} onMouseLeave={()=>onShowMenu(null)}>⋮</div></td>
                        <td><InlineText value={r.name} onSave={v=>onUpdate(r.id,'name',v)} placeholder="이름"/></td>
                        <td><InlineText value={r.contact} onSave={v=>onUpdate(r.id,'contact',v)} placeholder="연락처"/></td>
                        <td><InlineText value={r.job} onSave={v=>onUpdate(r.id,'job',v)} placeholder="직무"/></td>
                        <td><select className="inline-select" value={r.type} onChange={e=>onUpdateType(r.id,e.target.value)}><option value="">선택</option><option>지원자</option><option>포지션 제안자</option></select></td>
                        <td><select className="inline-select" value={r.platform} onChange={e=>onUpdate(r.id,'platform',e.target.value)}>{plats.map(p=><option key={p}>{p}</option>)}</select></td>
                        <td><input className="inline-input" type="date" value={r.date} onChange={e=>onUpdate(r.id,'date',e.target.value)}/></td>
                        <td><input className="inline-input" type="time" value={r.time||''} onChange={e=>onUpdate(r.id,'time',e.target.value)}/></td>
                        <td><InlineText value={r.interviewer} onSave={v=>onUpdate(r.id,'interviewer',v)}/></td>
                        <td><select className="inline-select" value={r.manager} onChange={e=>onUpdate(r.id,'manager',e.target.value)}><option value="">선택</option>{appSettings.managers.map(m=><option key={m}>{m}</option>)}</select></td>
                        <td><select className="inline-select" value={r.attendance||''} onChange={e=>onUpdate(r.id,'attendance',e.target.value)}><option value="">-</option><option>확인중</option><option>불참</option><option>참석확인</option><option>참석</option></select></td>
                        <td><select className="inline-select" value={r.passed||''} onChange={e=>onUpdate(r.id,'passed',e.target.value)}><option value="">-</option><option>불합격</option><option>합격</option></select></td>
                        <td><select className="inline-select" value={r.guided||''} onChange={e=>onUpdate(r.id,'guided',e.target.value)}><option value="">-</option><option>안내완료</option><option>미안내</option></select></td>
                        <td><input className="inline-input" type="date" value={r.startDate||''} onChange={e=>onUpdate(r.id,'startDate',e.target.value)}/></td>
                        <td><InlineText value={r.memo} onSave={v=>onUpdate(r.id,'memo',v)}/></td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════
   ONBOARD PAGE
═══════════════════════════════════════════ */
const OnboardPage = React.memo(function OnboardPage({ data, filter, setFilter, onUpdate, onAdd, onShowMenu, appSettings }) {
  const [collapsed, setCollapsed] = useState(new Set());
  const initDoneO = useRef(false);
  useEffect(() => {
    if (initDoneO.current || data.length === 0) return;
    initDoneO.current = true;
    const months = [...new Set(data.map(r => r.date?.slice(0,7)||'none'))];
    months.sort((a,b) => b==='none'?1:a==='none'?-1:b.localeCompare(a));
    const latest = months.find(m => m !== 'none');
    setCollapsed(new Set(months.filter(m => m !== latest)));
  }, [data]);
  const toggleM = m => setCollapsed(p => { const n=new Set(p); n.has(m)?n.delete(m):n.add(m); return n; });
  const { tbRef: oTbRef, grab: oGrab, init: oW } = useColResize([28,130,120,160,118,88,90,72,84,80,76,120]);

  const filtered = useMemo(() =>
    data.filter(r =>
      (!filter.search || r.name.toLowerCase().includes(filter.search) || r.job.toLowerCase().includes(filter.search)) &&
      (!filter.manager || r.manager === filter.manager) &&
      (!filter.status || r.status === filter.status)
    ).sort((a,b) => b.date.localeCompare(a.date)),
    [data, filter]
  );
  const hl = getHighlightDate(filtered);
  const yesNoSel = (val, field, id) => (
    <select className="inline-select" value={val||''} onChange={e=>onUpdate(id,field,e.target.value)}>
      <option value="">-</option><option>완료</option><option>미완료</option>
    </select>
  );

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">교육 및 입사자</div><div className="page-desc">합격자 입사 일정 및 교육 현황</div></div>
        <button className="btn btn-primary" onClick={onAdd}><Plus size={14}/> 행 추가</button>
      </div>
      <div className="table-toolbar">
        <div className="search-wrap"><Search size={14}/><input className="search-input" placeholder="이름 검색..." value={filter.search} onChange={e=>setFilter(f=>({...f,search:e.target.value.toLowerCase()}))}/></div>
        <span className="filter-label">담당자</span>
        <select className="filter-select" value={filter.manager} onChange={e=>setFilter(f=>({...f,manager:e.target.value}))}><option value="">전체</option>{appSettings.managers.map(m=><option key={m}>{m}</option>)}</select>
        <span className="filter-label">상태</span>
        <select className="filter-select" value={filter.status} onChange={e=>setFilter(f=>({...f,status:e.target.value}))}><option value="">전체</option><option>입사 예정</option><option>교육 중</option><option>입사 완료</option><option>입사 취소</option></select>
      </div>
      <div className="table-wrap">
        <table ref={oTbRef} className="data-table" style={{tableLayout:'fixed'}}>
          <colgroup>{oW.map((w,i)=><col key={i} style={{width:w}}/>)}</colgroup>
          <thead><tr>
            <th/>
            {['이름','연락처','직무','입사예정일','담당자','상태','참석여부','이메일생성','FLEX가입','계약서','비고'].map((h,i)=>(
              <th key={h}>{h}<span className="col-rsz" onMouseDown={e=>oGrab(i+1,e)}/></th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.length===0
              ? <tr><td colSpan={11}><div className="empty-state"><p>등록된 입사자가 없습니다</p></div></td></tr>
              : groupByMonth(filtered).map(([month, rows]) => (
                <React.Fragment key={month}>
                  <tr className="month-group-header" onClick={()=>toggleM(month)}>
                    <td colSpan={12} style={{padding:'7px 12px'}}>
                      {collapsed.has(month)?'▶ ':'▼ '}{fmtMonth(month)}
                      <span style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:'normal',marginLeft:8}}>{rows.length}건</span>
                    </td>
                  </tr>
                  {!collapsed.has(month) && rows.map(r => (
                    <tr key={r.id} className={r.date===hl?'row-today':''}>
                      <td className="row-handle-cell"><div className="row-handle-dot" onMouseEnter={e=>onShowMenu(e,r.id,'onboard')} onMouseLeave={()=>onShowMenu(null)}>⋮</div></td>
                      <td><InlineText value={r.name} onSave={v=>onUpdate(r.id,'name',v)} placeholder="이름"/></td>
                      <td><InlineText value={r.contact} onSave={v=>onUpdate(r.id,'contact',v)} placeholder="연락처"/></td>
                      <td><InlineText value={r.job} onSave={v=>onUpdate(r.id,'job',v)} placeholder="직무"/></td>
                      <td><input className="inline-input" type="date" value={r.date} onChange={e=>onUpdate(r.id,'date',e.target.value)}/></td>
                      <td><select className="inline-select" value={r.manager} onChange={e=>onUpdate(r.id,'manager',e.target.value)}><option value="">선택</option>{appSettings.managers.map(m=><option key={m}>{m}</option>)}</select></td>
                      <td><select className="inline-select" value={r.status} onChange={e=>onUpdate(r.id,'status',e.target.value)}>{['입사 예정','교육 중','입사 완료','입사 취소'].map(s=><option key={s}>{s}</option>)}</select></td>
                      <td><select className="inline-select" value={r.attendance||''} onChange={e=>onUpdate(r.id,'attendance',e.target.value)}><option value="">-</option><option>참석</option><option>불참</option></select></td>
                      <td>{yesNoSel(r.emailCreated,'emailCreated',r.id)}</td>
                      <td>{yesNoSel(r.flexJoined,'flexJoined',r.id)}</td>
                      <td>{yesNoSel(r.contractSigned,'contractSigned',r.id)}</td>
                      <td><InlineText value={r.memo} onSave={v=>onUpdate(r.id,'memo',v)}/></td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════
   PROPOSAL PAGE
═══════════════════════════════════════════ */
const ProposalPage = React.memo(function ProposalPage({ data, filter, setFilter, onUpdate, onAdd, onShowMenu, appSettings }) {
  const [collapsed, setCollapsed] = useState(new Set());
  const initDoneP = useRef(false);
  useEffect(() => {
    if (initDoneP.current || data.length === 0) return;
    initDoneP.current = true;
    const months = [...new Set(data.map(r => r.date?.slice(0,7)||'none'))];
    months.sort((a,b) => b==='none'?1:a==='none'?-1:b.localeCompare(a));
    const latest = months.find(m => m !== 'none');
    setCollapsed(new Set(months.filter(m => m !== latest)));
  }, [data]);
  const toggleM = m => setCollapsed(p => { const n=new Set(p); n.has(m)?n.delete(m):n.add(m); return n; });
  const { tbRef: pTbRef, grab: pGrab, init: pW } = useColResize([28,130,120,160,100,88,118,80,120]);

  const filtered = useMemo(() =>
    data.filter(r =>
      (!filter.search || r.name.toLowerCase().includes(filter.search) || r.job.toLowerCase().includes(filter.search)) &&
      (!filter.manager || r.manager === filter.manager) &&
      (!filter.platform || r.platform === filter.platform) &&
      (!filter.result || r.result === filter.result)
    ).sort((a,b) => b.date.localeCompare(a.date)),
    [data, filter]
  );
  const hl = getHighlightDate(filtered);

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">포지션 제안 O/B 현황</div><div className="page-desc">담당자별 포지션 제안 내역 관리</div></div>
        <button className="btn btn-primary" onClick={onAdd}><Plus size={14}/> 행 추가</button>
      </div>
      <div className="table-toolbar">
        <div className="search-wrap"><Search size={14}/><input className="search-input" placeholder="이름 검색..." value={filter.search} onChange={e=>setFilter(f=>({...f,search:e.target.value.toLowerCase()}))}/></div>
        <span className="filter-label">담당자</span>
        <select className="filter-select" value={filter.manager} onChange={e=>setFilter(f=>({...f,manager:e.target.value}))}><option value="">전체</option>{appSettings.managers.map(m=><option key={m}>{m}</option>)}</select>
        <span className="filter-label">플랫폼</span>
        <select className="filter-select" value={filter.platform} onChange={e=>setFilter(f=>({...f,platform:e.target.value}))}><option value="">전체</option>{appSettings.proposalPlatforms.map(p=><option key={p}>{p}</option>)}</select>
        <span className="filter-label">결과</span>
        <select className="filter-select" value={filter.result} onChange={e=>setFilter(f=>({...f,result:e.target.value}))}><option value="">전체</option><option>대기</option><option>응답</option><option>미응답</option><option>거절</option><option>면접진행</option></select>
      </div>
      <div className="table-wrap">
        <table ref={pTbRef} className="data-table" style={{tableLayout:'fixed'}}>
          <colgroup>{pW.map((w,i)=><col key={i} style={{width:w}}/>)}</colgroup>
          <thead><tr>
            <th/>
            {['이름','연락처','직무','플랫폼','담당자','제안일','결과','메모'].map((h,i)=>(
              <th key={h}>{h}<span className="col-rsz" onMouseDown={e=>pGrab(i+1,e)}/></th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.length===0
              ? <tr><td colSpan={8}><div className="empty-state"><p>등록된 포지션 제안이 없습니다</p></div></td></tr>
              : groupByMonth(filtered).map(([month, rows]) => (
                <React.Fragment key={month}>
                  <tr className="month-group-header" onClick={()=>toggleM(month)}>
                    <td colSpan={9} style={{padding:'7px 12px'}}>
                      {collapsed.has(month)?'▶ ':'▼ '}{fmtMonth(month)}
                      <span style={{fontSize:11,color:'var(--color-text-muted)',fontWeight:'normal',marginLeft:8}}>{rows.length}건</span>
                    </td>
                  </tr>
                  {!collapsed.has(month) && rows.map(r => (
                    <tr key={r.id} className={r.date===hl?'row-today':''}>
                      <td className="row-handle-cell"><div className="row-handle-dot" onMouseEnter={e=>onShowMenu(e,r.id,'proposal')} onMouseLeave={()=>onShowMenu(null)}>⋮</div></td>
                      <td><InlineText value={r.name} onSave={v=>onUpdate(r.id,'name',v)} placeholder="이름"/></td>
                      <td><InlineText value={r.contact} onSave={v=>onUpdate(r.id,'contact',v)} placeholder="연락처"/></td>
                      <td><InlineText value={r.job} onSave={v=>onUpdate(r.id,'job',v)} placeholder="직무"/></td>
                      <td><select className="inline-select" value={r.platform} onChange={e=>onUpdate(r.id,'platform',e.target.value)}>{appSettings.proposalPlatforms.map(p=><option key={p}>{p}</option>)}</select></td>
                      <td><select className="inline-select" value={r.manager} onChange={e=>onUpdate(r.id,'manager',e.target.value)}><option value="">선택</option>{appSettings.managers.map(m=><option key={m}>{m}</option>)}</select></td>
                      <td><input className="inline-input" type="date" value={r.date} onChange={e=>onUpdate(r.id,'date',e.target.value)}/></td>
                      <td><select className="inline-select" value={r.result} onChange={e=>onUpdate(r.id,'result',e.target.value)}>{['대기','수락','거절','면접진행'].map(s=><option key={s}>{s}</option>)}</select></td>
                      <td><InlineText value={r.memo} onSave={v=>onUpdate(r.id,'memo',v)}/></td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════
   SETTINGS PAGE
═══════════════════════════════════════════ */
const SettingsPage = React.memo(function SettingsPage({ settings, onUpdate }) {
  const [inputs, setInputs] = useState({});
  const setInput = (cat, val) => setInputs(p => ({...p, [cat]: val}));
  const addItem = (cat) => {
    const w = (inputs[cat]||'').trim();
    if (!w || (settings[cat]||[]).includes(w)) return;
    onUpdate({ ...settings, [cat]: [...(settings[cat]||[]), w] });
    setInput(cat, '');
  };
  const removeItem = (cat, idx) => onUpdate({ ...settings, [cat]: (settings[cat]||[]).filter((_,i)=>i!==idx) });

  const Section = ({ cat, label, emoji, tagCls, placeholder }) => (
    <div className="card" style={{marginBottom:12}}>
      <div className="card-title">{emoji} {label}</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10,minHeight:28}}>
        {(settings[cat]||[]).map((k,i)=>(
          <span key={i} className={`dept-tag ${tagCls||'dept-hq'}`}>{k}
            <button onClick={()=>removeItem(cat,i)} style={{marginLeft:4,opacity:.6,fontSize:12}}>×</button>
          </span>
        ))}
        {(settings[cat]||[]).length===0 && <span style={{fontSize:'var(--text-sm)',color:'var(--color-text-faint)'}}>항목 없음</span>}
      </div>
      <div style={{display:'flex',gap:8}}>
        <input className="search-input" style={{flex:1}} value={inputs[cat]||''}
          onChange={e=>setInput(cat,e.target.value)}
          placeholder={placeholder||'항목 입력 후 Enter...'}
          onKeyDown={e=>e.key==='Enter'&&addItem(cat)}/>
        <button className="btn btn-secondary" onClick={()=>addItem(cat)}>추가</button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">설정</div><div className="page-desc">드롭다운 항목 및 부서 분류 키워드를 관리합니다</div></div>
      </div>

      <div className="settings-section-label">부서 분류 키워드</div>
      <Section cat="sales" label="영업 — 직무 포함 키워드" emoji="🏪" tagCls="dept-sales" placeholder="키워드 입력 후 Enter..."/>
      <Section cat="fnb"   label="F&B — 직무 포함 키워드"  emoji="🍽️" tagCls="dept-fnb"  placeholder="키워드 입력 후 Enter..."/>
      <div className="card" style={{marginBottom:20}}>
        <div className="card-title">🏢 본사</div>
        <p style={{fontSize:'var(--text-sm)',color:'var(--color-text-muted)'}}>영업 / F&B 키워드에 해당하지 않는 모든 직무는 자동으로 본사로 분류됩니다.</p>
      </div>

      <div className="settings-section-label">드롭다운 항목 관리</div>
      <Section cat="managers"          label="담당자 목록"    emoji="👤"/>
      <Section cat="applicantPlatforms" label="지원자 플랫폼"  emoji="📋"/>
      <Section cat="proposalPlatforms"  label="제안 플랫폼"    emoji="📤"/>
      <Section cat="costVendors"        label="채용 비용 업체" emoji="💳"/>
      <Section cat="costNotes"          label="채용 비용 비고 (사업장)" emoji="📝" placeholder="사업장명 입력 후 Enter..."/>
    </div>
  );
});

/* ═══════════════════════════════════════════
   COST PAGE
═══════════════════════════════════════════ */
const COST_PLAT_TABS = ['전체', '사람인', '잡코리아', '원티드', '리멤버', '알바몬'];

const CostPage = React.memo(function CostPage({ data, onUpdate, onAdd, onShowMenu, appSettings }) {
  const [vendorTab, setVendorTab] = useState('전체');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const { tbRef: cTbRef, grab: cGrab, init: cW } = useColResize([28, 80, 110, 110, 130, 200, 100, 110, 170]);
  const isAll = vendorTab === '전체';

  const filtered = useMemo(() => {
    let rows = [...data];
    if (!isAll) rows = rows.filter(r => r.vendor === vendorTab);
    if (dateFrom) rows = rows.filter(r => r.date >= dateFrom);
    if (dateTo) rows = rows.filter(r => r.date <= dateTo);
    return rows.sort((a,b) => (b.date||'').localeCompare(a.date||''));
  }, [data, vendorTab, isAll, dateFrom, dateTo]);

  const totalAmount = filtered.reduce((s,r) => s+(Number(r.amount)||0), 0);
  const vendorTotals = {};
  if (isAll) filtered.forEach(r => { if(r.vendor) vendorTotals[r.vendor] = (vendorTotals[r.vendor]||0)+(Number(r.amount)||0); });

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">채용 비용</div><div className="page-desc">플랫폼별 채용 광고 비용 관리</div></div>
        {!isAll && <button className="btn btn-primary" onClick={()=>onAdd(vendorTab)}><Plus size={14}/> 행 추가</button>}
      </div>

      <div className="tabs">
        {COST_PLAT_TABS.map(tab=>(
          <button key={tab} className={`tab-btn ${vendorTab===tab?'active':''}`} onClick={()=>setVendorTab(tab)}>{tab}</button>
        ))}
      </div>

      <div className={`cost-notice${isAll?'':' editable'}`}>
        {isAll
          ? '전체 보기입니다. 내용을 수정하려면 각 플랫폼 탭을 선택하세요.'
          : `${vendorTab} 탭 — 행 추가 및 수정이 가능합니다.`}
      </div>

      <div className="cost-summary-bar">
        <div className="cost-summary-card cost-summary-total">
          <span className="cost-summary-label">합계</span>
          <span className="cost-summary-value">{fmtAmount(totalAmount)}</span>
        </div>
        {isAll && Object.entries(vendorTotals).sort((a,b)=>b[1]-a[1]).map(([v,amt])=>(
          <div key={v} className="cost-summary-card">
            <span className="cost-summary-label">{v}</span>
            <span className="cost-summary-value">{fmtAmount(amt)}</span>
          </div>
        ))}
      </div>

      <div className="table-toolbar">
        <span className="filter-label">결제일</span>
        <input className="filter-select" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{width:130}}/>
        <span style={{color:'var(--color-text-muted)',fontSize:'var(--text-sm)'}}>~</span>
        <input className="filter-select" type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{width:130}}/>
        {(dateFrom||dateTo) && <button className="btn btn-secondary" onClick={()=>{setDateFrom('');setDateTo('');}}>초기화</button>}
        <span style={{marginLeft:'auto',fontSize:'var(--text-sm)',color:'var(--color-text-muted)'}}>{filtered.length}건</span>
      </div>

      <div className="table-wrap">
        <table ref={cTbRef} className="data-table" style={{tableLayout:'fixed'}}>
          <colgroup>{cW.map((w,i)=><col key={i} style={{width:w}}/>)}</colgroup>
          <thead><tr>
            <th/>
            {['구분','업체명','분류','금액','구매 내용','비고','결제일','유료 진행기간'].map((h,i)=>(
              <th key={h}>{h}<span className="col-rsz" onMouseDown={e=>cGrab(i+1,e)}/></th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.length===0
              ? <tr><td colSpan={9}><div className="empty-state"><p>등록된 비용 내역이 없습니다</p></div></td></tr>
              : filtered.map(r=>(
                <tr key={r.id}>
                  <td className="row-handle-cell">
                    {!isAll && <div className="row-handle-dot" onMouseEnter={e=>onShowMenu(e,r.id,'cost')} onMouseLeave={()=>onShowMenu(null)}>⋮</div>}
                  </td>
                  {isAll ? (
                    <>
                      <td style={{fontSize:'var(--text-sm)',padding:'4px 8px'}}>{r.category||'-'}</td>
                      <td style={{fontSize:'var(--text-sm)',padding:'4px 8px'}}>{r.vendor||'-'}</td>
                      <td style={{fontSize:'var(--text-sm)',padding:'4px 8px'}}>{r.classification||'-'}</td>
                      <td style={{fontSize:'var(--text-sm)',padding:'4px 8px',textAlign:'right'}}>{r.amount?Number(r.amount).toLocaleString('ko-KR'):'0'}원</td>
                      <td style={{fontSize:'var(--text-sm)',padding:'4px 8px'}}>{r.description||'-'}</td>
                      <td style={{fontSize:'var(--text-sm)',padding:'4px 8px'}}>{r.note||'-'}</td>
                      <td style={{fontSize:'var(--text-sm)',padding:'4px 8px'}}>{r.date||'-'}</td>
                      <td style={{fontSize:'var(--text-sm)',padding:'4px 8px'}}>{r.period||'-'}</td>
                    </>
                  ) : (
                    <>
                      <td><InlineText value={r.category} onSave={v=>onUpdate(r.id,'category',v)} placeholder="채용"/></td>
                      <td>
                        <select className="inline-select" value={r.vendor||''} onChange={e=>onUpdate(r.id,'vendor',e.target.value)}>
                          <option value="">선택</option>
                          {appSettings.costVendors.map(p=><option key={p}>{p}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="inline-select" value={r.classification||''} onChange={e=>onUpdate(r.id,'classification',e.target.value)}>
                          <option value="">선택</option>
                          <option>포지션 제안</option>
                          <option>유료 채용 공고</option>
                          <option>기타</option>
                        </select>
                      </td>
                      <td><AmountInput value={r.amount} onSave={v=>onUpdate(r.id,'amount',v)}/></td>
                      <td><InlineText value={r.description} onSave={v=>onUpdate(r.id,'description',v)} placeholder="구매 내용"/></td>
                      <td>
                        <select className="inline-select" value={r.note||''} onChange={e=>onUpdate(r.id,'note',e.target.value)}>
                          <option value="">-</option>
                          {(appSettings.costNotes||[]).map(n=><option key={n}>{n}</option>)}
                        </select>
                      </td>
                      <td><DateInput value={r.date||''} onSave={v=>onUpdate(r.id,'date',v)}/></td>
                      <td><InlineText value={r.period} onSave={v=>onUpdate(r.id,'period',v)} placeholder="2025-06-01~2025-06-30"/></td>
                    </>
                  )}
                </tr>
              ))
            }
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr style={{background:'var(--color-surface-offset)',fontWeight:600}}>
                <td colSpan={4} style={{textAlign:'right',fontSize:12,padding:'6px 12px',color:'var(--color-text-muted)'}}>합계</td>
                <td style={{fontSize:12,padding:'6px 12px',textAlign:'right'}}>{fmtAmount(totalAmount)}</td>
                <td colSpan={4}/>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════
   J/D REPORT MODAL
═══════════════════════════════════════════ */
function JDReport({ jds, costs, onClose }) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일`;
  const active = jds.filter(r => r.status === '진행중');
  const closed  = jds.filter(r => r.status === '마감');
  const totalCost = costs.reduce((s,r) => s+(Number(r.amount)||0), 0);
  const vendorCosts = {};
  costs.forEach(r => { if(r.vendor) vendorCosts[r.vendor] = (vendorCosts[r.vendor]||0)+(Number(r.amount)||0); });
  const byCompany = {};
  active.forEach(r => { (byCompany[r.company] = byCompany[r.company]||[]).push(r); });

  const handlePrint = () => {
    const el = document.getElementById('jd-report-inner');
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>채용 현황 보고서</title><style>
      body{font-family:sans-serif;padding:32px;color:#111;font-size:13px}
      h1{font-size:20px;margin:0 0 4px}
      h2{font-size:14px;margin:20px 0 8px;border-bottom:2px solid #111;padding-bottom:4px}
      table{width:100%;border-collapse:collapse;margin-bottom:10px}
      th{background:#f0f0f0;padding:5px 8px;text-align:left;border:1px solid #ccc;font-size:11px}
      td{padding:5px 8px;border:1px solid #ccc;font-size:12px}
      .kpi-row{display:flex;gap:12px;margin:12px 0}
      .kpi{border:1px solid #ddd;border-radius:4px;padding:10px 14px;flex:1}
      .kpi-l{font-size:11px;color:#666}.kpi-v{font-size:18px;font-weight:700;margin-top:3px}
    </style></head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const thStyle = { padding:'5px 8px', textAlign:'left', borderBottom:'1px solid var(--color-divider)', fontWeight:600, background:'var(--color-surface-offset)' };
  const tdStyle = (i) => ({ padding:'5px 8px', borderBottom:'1px solid var(--color-divider)', background: i%2===0?'transparent':'var(--color-surface-offset)' });

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:1000,overflowY:'auto',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'24px 16px'}} onClick={onClose}>
      <div style={{background:'var(--color-surface)',borderRadius:12,padding:28,width:'100%',maxWidth:820}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:'var(--text-lg)'}}>보고서 미리보기</div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-primary" onClick={handlePrint}>🖨️ 인쇄 / PDF 저장</button>
            <button className="btn btn-secondary" onClick={onClose}>✕</button>
          </div>
        </div>

        <div id="jd-report-inner">
          <h1 style={{margin:'0 0 4px',fontWeight:700}}>채용 현황 보고서</h1>
          <div style={{fontSize:'var(--text-xs)',color:'var(--color-text-muted)',marginBottom:20}}>
            생성일: {dateStr} &nbsp;|&nbsp; 진행중 {active.length}개 &nbsp;|&nbsp; 마감 {closed.length}개 &nbsp;|&nbsp; 총 채용 비용 {fmtAmount(totalCost)}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:24}}>
            {[['총 진행중 포지션',`${active.length}개`],['마감 포지션',`${closed.length}개`],['총 채용 비용',fmtAmount(totalCost)],['집행 플랫폼',`${Object.keys(vendorCosts).length}개`]].map(([l,v])=>(
              <div key={l} className="kpi-card"><div className="kpi-label">{l}</div><div className="kpi-value" style={{fontSize:'var(--text-base)'}}>{v}</div></div>
            ))}
          </div>

          <div style={{fontWeight:700,fontSize:'var(--text-sm)',marginBottom:10,paddingBottom:4,borderBottom:'2px solid var(--color-divider)'}}>1. 채용 진행중 포지션</div>
          {Object.entries(byCompany).map(([company, rows]) => (
            <div key={company} style={{marginBottom:14}}>
              <div style={{fontWeight:600,fontSize:'var(--text-xs)',color:'var(--color-text-muted)',marginBottom:5}}>{company}</div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'var(--text-xs)'}}>
                <thead><tr>{['본부/부서','팀','포지션','경력 구분'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                <tbody>
                  {rows.map((r,i)=>(
                    <tr key={r.id}>
                      <td style={tdStyle(i)}>{r.division}</td>
                      <td style={tdStyle(i)}>{r.team}</td>
                      <td style={{...tdStyle(i),fontWeight:600}}>{r.position}</td>
                      <td style={tdStyle(i)}>{r.experienceLevel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {closed.length > 0 && <>
            <div style={{fontWeight:700,fontSize:'var(--text-sm)',margin:'20px 0 10px',paddingBottom:4,borderBottom:'2px solid var(--color-divider)'}}>2. 마감 포지션</div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'var(--text-xs)',marginBottom:16}}>
              <thead><tr>{['회사','팀','포지션','경력 구분'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>
                {closed.map((r,i)=>(
                  <tr key={r.id}>
                    <td style={tdStyle(i)}>{r.company}</td>
                    <td style={tdStyle(i)}>{r.team}</td>
                    <td style={{...tdStyle(i),fontWeight:600}}>{r.position}</td>
                    <td style={tdStyle(i)}>{r.experienceLevel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>}

          <div style={{fontWeight:700,fontSize:'var(--text-sm)',margin:'20px 0 10px',paddingBottom:4,borderBottom:'2px solid var(--color-divider)'}}>3. 채용 비용 현황</div>
          {Object.keys(vendorCosts).length > 0 ? (
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'var(--text-xs)'}}>
              <thead><tr>{['플랫폼','집행 비용','비율'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>
                {Object.entries(vendorCosts).sort((a,b)=>b[1]-a[1]).map(([v,amt],i)=>(
                  <tr key={v}>
                    <td style={tdStyle(i)}>{v}</td>
                    <td style={{...tdStyle(i),textAlign:'right'}}>{fmtAmount(amt)}</td>
                    <td style={{...tdStyle(i),textAlign:'right'}}>{Math.round(amt/totalCost*100)}%</td>
                  </tr>
                ))}
                <tr style={{fontWeight:700}}>
                  <td style={{padding:'6px 8px'}}>합계</td>
                  <td style={{padding:'6px 8px',textAlign:'right'}}>{fmtAmount(totalCost)}</td>
                  <td style={{padding:'6px 8px',textAlign:'right'}}>100%</td>
                </tr>
              </tbody>
            </table>
          ) : <div style={{fontSize:'var(--text-sm)',color:'var(--color-text-faint)'}}>채용 비용 탭에서 비용을 입력하면 여기에 표시됩니다.</div>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   COST PLAN REPORT MODAL
═══════════════════════════════════════════ */
const PLAT_KEYS   = ['saramin','jobkorea','albamon','wanted'];
const PLAT_LABELS = { saramin:'사람인', jobkorea:'잡코리아', albamon:'알바몬', wanted:'원티드' };

function CostPlanReport({ activeJDs, periods, plan, onClose }) {
  const parseAmt = t => { if(!t||!t.trim()||t.trim()==='-') return 0; const n=Number(t.replace(/[^0-9]/g,'')); return isNaN(n)?0:n; };
  const totals = {};
  PLAT_KEYS.forEach(k => { totals[k] = activeJDs.reduce((s,r) => s+parseAmt((plan[r.id]||{})[k]), 0); });
  const grandTotal = Object.values(totals).reduce((s,v)=>s+v, 0);
  const colH = k => PLAT_LABELS[k] + (periods[k] ? ` (${periods[k]})` : '');

  const handlePrint = () => {
    const el = document.getElementById('cost-plan-rpt-inner');
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>채용 예상 비용 보고서</title><style>
      body{font-family:sans-serif;padding:32px;color:#111;font-size:13px}
      h1{font-size:20px;margin:0 0 4px} h2{font-size:14px;margin:20px 0 8px;border-bottom:2px solid #111;padding-bottom:4px}
      table{width:100%;border-collapse:collapse;margin-bottom:10px}
      th{background:#f0f0f0;padding:5px 8px;text-align:left;border:1px solid #ccc;font-size:11px}
      td{padding:5px 8px;border:1px solid #ccc;font-size:12px}
      .total-row{background:#fffbeb;font-weight:700} .sum-row{background:#f0fdf4;font-weight:700}
    </style></head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const thS = { padding:'6px 8px', textAlign:'left', borderBottom:'1px solid var(--color-divider)', background:'var(--color-surface-offset)', fontWeight:600 };
  const tdS = (i) => ({ padding:'5px 8px', borderBottom:'1px solid var(--color-divider)', background: i%2===0?'transparent':'var(--color-surface-offset)' });

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:1000,overflowY:'auto',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'24px 16px'}} onClick={onClose}>
      <div style={{background:'var(--color-surface)',borderRadius:12,padding:28,width:'100%',maxWidth:900}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:'var(--text-lg)'}}>채용 예상 비용 보고서</div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-primary" onClick={handlePrint}>🖨️ 인쇄 / PDF</button>
            <button className="btn btn-secondary" onClick={onClose}>✕</button>
          </div>
        </div>

        <div id="cost-plan-rpt-inner">
          <h1 style={{margin:'0 0 4px',fontWeight:700}}>채용 예상 비용 보고서</h1>
          <div style={{fontSize:'var(--text-xs)',color:'var(--color-text-muted)',marginBottom:20}}>
            진행중 포지션 {activeJDs.length}개 · 총 예상 비용 {fmtAmount(grandTotal)}
          </div>

          <h2 style={{fontWeight:700,fontSize:'var(--text-sm)',marginBottom:10,paddingBottom:4,borderBottom:'2px solid var(--color-divider)'}}>1. 포지션별 예상 채용 비용</h2>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'var(--text-xs)',minWidth:600}}>
              <thead>
                <tr>
                  <th style={thS}>채용모집군</th>
                  {PLAT_KEYS.map(k=><th key={k} style={{...thS,textAlign:'right'}}>{colH(k)}</th>)}
                  <th style={thS}>비고</th>
                </tr>
              </thead>
              <tbody>
                {activeJDs.map((r,i)=>(
                  <tr key={r.id}>
                    <td style={{...tdS(i),fontWeight:500}}>{r.position}</td>
                    {PLAT_KEYS.map(k=><td key={k} style={{...tdS(i),textAlign:'right'}}>{(plan[r.id]||{})[k]||'-'}</td>)}
                    <td style={tdS(i)}>{(plan[r.id]||{}).note||'-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{fontWeight:600,background:'var(--color-surface-offset)'}}>
                  <td style={{padding:'6px 8px',borderTop:'2px solid var(--color-divider)'}}>예상 비용 소계</td>
                  {PLAT_KEYS.map(k=><td key={k} style={{padding:'6px 8px',borderTop:'2px solid var(--color-divider)',textAlign:'right'}}>{totals[k]>0?fmtAmount(totals[k]):'-'}</td>)}
                  <td style={{padding:'6px 8px',borderTop:'2px solid var(--color-divider)'}}/>
                </tr>
                <tr style={{fontWeight:700,background:'var(--color-gold-light)',color:'var(--color-gold)'}}>
                  <td style={{padding:'7px 8px'}}>총 예상 비용</td>
                  <td colSpan={PLAT_KEYS.length} style={{padding:'7px 8px',textAlign:'right',fontSize:'var(--text-sm)'}}>{fmtAmount(grandTotal)}</td>
                  <td style={{padding:'7px 8px'}}/>
                </tr>
              </tfoot>
            </table>
          </div>

          <h2 style={{fontWeight:700,fontSize:'var(--text-sm)',margin:'24px 0 10px',paddingBottom:4,borderBottom:'2px solid var(--color-divider)'}}>2. 예상 채용 비용 현황</h2>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'var(--text-xs)'}}>
            <thead><tr>
              <th style={thS}>플랫폼</th>
              <th style={{...thS,textAlign:'right'}}>예상 비용</th>
              <th style={{...thS,textAlign:'right'}}>비율</th>
            </tr></thead>
            <tbody>
              {PLAT_KEYS.filter(k=>totals[k]>0).sort((a,b)=>totals[b]-totals[a]).map((k,i)=>(
                <tr key={k}>
                  <td style={tdS(i)}>{PLAT_LABELS[k]}</td>
                  <td style={{...tdS(i),textAlign:'right'}}>{fmtAmount(totals[k])}</td>
                  <td style={{...tdS(i),textAlign:'right'}}>{grandTotal>0?Math.round(totals[k]/grandTotal*100):0}%</td>
                </tr>
              ))}
              <tr style={{fontWeight:700}}>
                <td style={{padding:'6px 8px',borderTop:'2px solid var(--color-divider)'}}>합계</td>
                <td style={{padding:'6px 8px',borderTop:'2px solid var(--color-divider)',textAlign:'right'}}>{fmtAmount(grandTotal)}</td>
                <td style={{padding:'6px 8px',borderTop:'2px solid var(--color-divider)',textAlign:'right'}}>100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   J/D PAGE
═══════════════════════════════════════════ */
const JDPage = React.memo(function JDPage({ data, onSaveAll, costs }) {
  const [companyTab, setCompanyTab]   = useState('전체');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [expandedId, setExpandedId]   = useState(null);
  const [editingId, setEditingId]     = useState(null);
  const [editForm, setEditForm]       = useState({});
  const [showReport, setShowReport]   = useState(false);
  const [addingNew, setAddingNew]     = useState(false);
  const blankForm = { company:'본사', division:'', team:'', position:'', experienceLevel:'', status:'진행중', duties:'', requirements:'', preferred:'' };
  const [newForm, setNewForm]         = useState(blankForm);

  // 보고서 관리 탭 상태
  const [periods, setPeriods]       = useState(() => { try { return JSON.parse(localStorage.getItem('jdPeriods'))||{}; } catch { return {}; } });
  const [localPlan, setLocalPlan]   = useState(() => { const p={}; data.forEach(r=>{ p[r.id]={saramin:'',jobkorea:'',albamon:'',wanted:'',note:'',...(r.costPlan||{})}; }); return p; });
  const [showCostReport, setShowCostReport] = useState(false);
  const [planDirty, setPlanDirty]   = useState(false);

  useEffect(() => {
    setLocalPlan(prev => {
      const p={...prev};
      data.forEach(r=>{ if(!p[r.id]) p[r.id]={saramin:'',jobkorea:'',albamon:'',wanted:'',note:'',...(r.costPlan||{})}; });
      return p;
    });
  }, [data]);

  const parseAmt = t => { if(!t||!t.trim()||t.trim()==='-') return 0; const n=Number(t.replace(/[^0-9]/g,'')); return isNaN(n)?0:n; };
  const activeJDs = data.filter(r => r.status==='진행중');
  const planTotals = {};
  PLAT_KEYS.forEach(k=>{ planTotals[k]=activeJDs.reduce((s,r)=>s+parseAmt((localPlan[r.id]||{})[k]),0); });
  const planGrandTotal = Object.values(planTotals).reduce((s,v)=>s+v,0);

  const updateLocalPlan = (id, field, value) => {
    setLocalPlan(prev=>({...prev,[id]:{...(prev[id]||{}),[field]:value}}));
    setPlanDirty(true);
  };
  const saveCostPlan = () => {
    const updated = data.map(r=>({...r, costPlan: localPlan[r.id]||r.costPlan||{}}));
    onSaveAll(updated);
    localStorage.setItem('jdPeriods', JSON.stringify(periods));
    setPlanDirty(false);
  };

  const filtered = useMemo(() => {
    let rows = data;
    if (companyTab !== '전체') rows = rows.filter(r => r.company === companyTab);
    if (statusFilter !== '전체') rows = rows.filter(r => r.status === statusFilter);
    return rows;
  }, [data, companyTab, statusFilter]);

  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach(r => { const k = r.division||r.company; (g[k]=g[k]||[]).push(r); });
    return Object.entries(g);
  }, [filtered]);

  const toggleStatus = r => onSaveAll(data.map(x => x.id===r.id ? {...x, status: x.status==='진행중'?'마감':'진행중'} : x));
  const startEdit  = r => { setEditForm({...r}); setEditingId(r.id); setExpandedId(r.id); };
  const saveEdit   = ()  => { onSaveAll(data.map(x => x.id===editForm.id ? {...editForm} : x)); setEditingId(null); };
  const deleteJD   = id  => { if(!window.confirm('이 포지션을 삭제하시겠습니까?')) return; onSaveAll(data.filter(x=>x.id!==id)); setEditingId(null); setExpandedId(null); };
  const saveNew    = ()  => {
    if(!newForm.position.trim()) { alert('포지션명을 입력해주세요.'); return; }
    const newId = data.length ? Math.max(...data.map(x=>x.id))+1 : 1;
    onSaveAll([...data, {...newForm, id:newId}]);
    setAddingNew(false); setNewForm(blankForm);
  };

  const taStyle = { width:'100%', resize:'vertical', background:'var(--color-surface)', border:'1px solid var(--color-divider)', borderRadius:6, padding:'8px 10px', fontSize:'var(--text-sm)', color:'var(--color-text)', fontFamily:'inherit', boxSizing:'border-box', marginTop:4 };
  const labelStyle = { fontSize:'var(--text-xs)', color:'var(--color-text-muted)', fontWeight:600, display:'block', marginBottom:3 };

  const EditForm = ({ form, setForm, onSave, onCancel, onDel, isNew }) => (
    <div style={{padding:'14px 16px', background:'var(--color-surface-offset)', borderRadius:6}}>
      <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:6}}>
        {[['회사','company', JD_COMPANIES],['본부/부서','division'],['팀','team'],['포지션명','position'],['경력 구분','experienceLevel'],['채용 상태','status',['진행중','마감']]].map(([label,field,opts])=>(
          <div key={field}>
            <label style={labelStyle}>{label}</label>
            {opts
              ? <select className="filter-select" style={{width:'100%'}} value={form[field]||''} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))}>
                  {opts.map(o=><option key={o}>{o}</option>)}
                </select>
              : <input className="search-input" style={{width:'100%'}} value={form[field]||''} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))}/>
            }
          </div>
        ))}
      </div>
      {[['업무','duties',5],['자격요건','requirements',4],['우대사항','preferred',4]].map(([label,field,rows])=>(
        <div key={field} style={{marginTop:8}}>
          <label style={labelStyle}>{label}</label>
          <textarea rows={rows} style={taStyle} value={form[field]||''} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))}/>
        </div>
      ))}
      <div style={{display:'flex',gap:8,marginTop:12}}>
        <button className="btn btn-primary" onClick={onSave}>저장</button>
        <button className="btn btn-secondary" onClick={onCancel}>취소</button>
        {!isNew && <button className="btn btn-secondary" style={{marginLeft:'auto',color:'var(--color-error)'}} onClick={onDel}>삭제</button>}
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">채용 J/D 관리</div><div className="page-desc">포지션별 JD 및 채용 진행 현황 관리</div></div>
        <div style={{display:'flex',gap:8}}>
          {companyTab !== '보고서 관리' ? <>
            <button className="btn btn-secondary" onClick={()=>setShowReport(true)}>📊 보고서</button>
            <button className="btn btn-primary" onClick={()=>{ setAddingNew(true); setExpandedId(null); setEditingId(null); }}><Plus size={14}/> 포지션 추가</button>
          </> : <>
            {planDirty && <button className="btn btn-secondary" onClick={saveCostPlan}>💾 저장</button>}
            <button className="btn btn-primary" onClick={()=>setShowCostReport(true)}>📊 보고서</button>
          </>}
        </div>
      </div>

      <div className="tabs">
        {['전체',...JD_COMPANIES,'보고서 관리'].map(c=>(
          <button key={c} className={`tab-btn ${companyTab===c?'active':''}`} onClick={()=>setCompanyTab(c)}>{c}</button>
        ))}
      </div>

      {companyTab !== '보고서 관리' ? <>
        <div className="table-toolbar">
          <span className="filter-label">상태</span>
          <select className="filter-select" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option>전체</option><option>진행중</option><option>마감</option>
          </select>
          <span style={{marginLeft:'auto',fontSize:'var(--text-sm)',color:'var(--color-text-muted)'}}>
            진행중 {data.filter(r=>r.status==='진행중').length}개 · 마감 {data.filter(r=>r.status==='마감').length}개
          </span>
        </div>

        {addingNew && (
          <div className="card" style={{marginBottom:14}}>
            <div style={{fontWeight:700,marginBottom:10,fontSize:'var(--text-sm)'}}>새 포지션 추가</div>
            <EditForm form={newForm} setForm={setNewForm} onSave={saveNew} onCancel={()=>setAddingNew(false)} isNew/>
          </div>
        )}

        {grouped.length === 0
          ? <div className="card" style={{textAlign:'center',color:'var(--color-text-faint)',padding:'40px 0'}}>등록된 포지션이 없습니다</div>
          : grouped.map(([division, rows]) => (
            <div key={division} className="card" style={{marginBottom:10,padding:'10px 14px'}}>
              <div style={{fontWeight:700,fontSize:'var(--text-xs)',color:'var(--color-text-muted)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.03em'}}>{division}</div>
              {rows.map(r => (
                <div key={r.id} style={{borderTop:'1px solid var(--color-divider)', background: r.status==='마감' ? 'var(--color-surface-offset)' : 'transparent', opacity: r.status==='마감' ? 0.6 : 1, transition:'opacity 0.15s'}}>
                  <div
                    onClick={()=>{ if(editingId===r.id) return; setExpandedId(expandedId===r.id?null:r.id); }}
                    style={{display:'flex',alignItems:'center',gap:10,padding:'9px 4px',cursor:editingId===r.id?'default':'pointer',userSelect:'none'}}
                    onMouseEnter={e=>{ if(editingId!==r.id) e.currentTarget.style.background='var(--color-divider)'; }}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                  >
                    <span style={{fontSize:10,color:'var(--color-text-faint)',width:12,flexShrink:0}}>{editingId!==r.id?(expandedId===r.id?'▼':'▶'):''}</span>
                    <span style={{flex:1,fontSize:'var(--text-sm)'}}>
                      {r.team && r.team!=='-' && <span style={{color:'var(--color-text-muted)',marginRight:4}}>{r.team}</span>}
                      <strong style={{textDecoration: r.status==='마감'?'line-through':'none'}}>{r.position}</strong>
                    </span>
                    <span style={{fontSize:'var(--text-xs)',color:'var(--color-text-muted)'}}>{r.experienceLevel}</span>
                    <span className={`badge ${r.status==='진행중'?'badge-green':'badge-gray'}`}>{r.status}</span>
                    <button className="btn btn-secondary" style={{fontSize:11,padding:'2px 8px'}} onClick={e=>{e.stopPropagation();toggleStatus(r);}}>{r.status==='진행중'?'마감':'재개'}</button>
                    <button className="btn btn-secondary" style={{fontSize:11,padding:'2px 8px'}} onClick={e=>{e.stopPropagation();startEdit(r);}}>편집</button>
                  </div>

                  {expandedId===r.id && editingId!==r.id && (
                    <div style={{padding:'10px 18px 14px',background:'var(--color-surface-offset)',fontSize:'var(--text-sm)',marginBottom:2}}>
                      {[['업무',r.duties],['자격요건',r.requirements],['우대사항',r.preferred]].filter(([,v])=>v).map(([label,val])=>(
                        <div key={label} style={{marginBottom:10}}>
                          <div style={{fontWeight:700,marginBottom:4}}>{label}</div>
                          <div style={{whiteSpace:'pre-line',color:'var(--color-text-muted)',lineHeight:1.75}}>{val}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {editingId===r.id && (
                    <div style={{marginBottom:4}}>
                      <EditForm form={editForm} setForm={setEditForm} onSave={saveEdit} onCancel={()=>setEditingId(null)} onDel={()=>deleteJD(r.id)}/>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        }
      </> : <>
        {/* ── 보고서 관리 탭 ── */}
        <div className="card" style={{marginBottom:12,padding:'12px 16px'}}>
          <div style={{fontWeight:600,fontSize:'var(--text-sm)',marginBottom:8}}>
            플랫폼 기간 설정 <span style={{fontWeight:400,fontSize:'var(--text-xs)',color:'var(--color-text-muted)'}}>— 열 제목에 표시됩니다</span>
          </div>
          <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
            {PLAT_KEYS.map(k=>(
              <div key={k} style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:'var(--text-sm)',color:'var(--color-text-muted)',minWidth:52}}>{PLAT_LABELS[k]}</span>
                <input className="search-input" style={{width:72}} placeholder="예: 3일"
                  value={periods[k]||''}
                  onChange={e=>setPeriods(p=>({...p,[k]:e.target.value}))}
                  onBlur={()=>{ localStorage.setItem('jdPeriods', JSON.stringify(periods)); }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{padding:'12px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div style={{fontWeight:600,fontSize:'var(--text-sm)'}}>
              진행중 포지션 예상 비용
              <span style={{fontWeight:400,fontSize:'var(--text-xs)',color:'var(--color-text-muted)',marginLeft:6}}>{activeJDs.length}개 포지션</span>
            </div>
            <div style={{display:'flex',gap:8}}>
              {planDirty && <button className="btn btn-secondary" style={{fontSize:12}} onClick={saveCostPlan}>💾 저장</button>}
              <span style={{fontSize:'var(--text-xs)',color:'var(--color-text-muted)',alignSelf:'center'}}>
                총 예상: <strong style={{color:'var(--color-primary)'}}>{fmtAmount(planGrandTotal)}</strong>
              </span>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table" style={{tableLayout:'fixed',minWidth:700}}>
              <colgroup>
                <col style={{width:190}}/>
                {PLAT_KEYS.map(k=><col key={k} style={{width:120}}/>)}
                <col style={{width:160}}/>
              </colgroup>
              <thead>
                <tr>
                  <th>채용모집군</th>
                  {PLAT_KEYS.map(k=><th key={k}>{PLAT_LABELS[k]}{periods[k]?` (${periods[k]})`:''}</th>)}
                  <th>비고</th>
                </tr>
              </thead>
              <tbody>
                {activeJDs.length === 0
                  ? <tr><td colSpan={6} style={{textAlign:'center',color:'var(--color-text-faint)',padding:'24px 0'}}>진행중인 포지션이 없습니다</td></tr>
                  : activeJDs.map(r=>(
                    <tr key={r.id}>
                      <td style={{fontWeight:500,fontSize:'var(--text-sm)'}}>{r.position}</td>
                      {PLAT_KEYS.map(k=>(
                        <td key={k}>
                          <InlineText value={(localPlan[r.id]||{})[k]||''} onSave={v=>updateLocalPlan(r.id,k,v)} placeholder="-"/>
                        </td>
                      ))}
                      <td><InlineText value={(localPlan[r.id]||{}).note||''} onSave={v=>updateLocalPlan(r.id,'note',v)} placeholder="-"/></td>
                    </tr>
                  ))
                }
              </tbody>
              {activeJDs.length > 0 && <tfoot>
                <tr style={{fontWeight:600,background:'var(--color-surface-offset)'}}>
                  <td style={{fontSize:'var(--text-xs)'}}>예상 비용 소계</td>
                  {PLAT_KEYS.map(k=><td key={k} style={{textAlign:'right',fontSize:'var(--text-xs)'}}>{planTotals[k]>0?fmtAmount(planTotals[k]):'-'}</td>)}
                  <td/>
                </tr>
                <tr style={{fontWeight:700,background:'var(--color-gold-light)',color:'var(--color-gold)'}}>
                  <td>총 예상 비용</td>
                  <td colSpan={PLAT_KEYS.length} style={{textAlign:'right'}}>{fmtAmount(planGrandTotal)}</td>
                  <td/>
                </tr>
              </tfoot>}
            </table>
          </div>
        </div>
      </>}

      {showReport && <JDReport jds={data} costs={costs} onClose={()=>setShowReport(false)}/>}
      {showCostReport && <CostPlanReport activeJDs={activeJDs} periods={periods} plan={localPlan} onClose={()=>setShowCostReport(false)}/>}
    </div>
  );
});

/* ═══════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════ */
export default function ClientApp() {
  const [interviews, setInterviews] = useState(DEFAULT_INTERVIEWS);
  const [onboards, setOnboards] = useState(DEFAULT_ONBOARDS);
  const [proposals, setProposals] = useState(DEFAULT_PROPOSALS);
  const [costs, setCosts] = useState([]);
  const [jds, setJDs] = useState(DEFAULT_JDS);
  const [page, setPage] = useState('dashboard');
  const [appSettings, setAppSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('appSettings'));
      if (saved) return { ...DEFAULT_APP_SETTINGS, ...saved };
      const old = JSON.parse(localStorage.getItem('deptSettings'));
      if (old) return { ...DEFAULT_APP_SETTINGS, sales: old.sales||DEFAULT_APP_SETTINGS.sales, fnb: old.fnb||DEFAULT_APP_SETTINGS.fnb };
    } catch {}
    return DEFAULT_APP_SETTINGS;
  });
  const updateAppSettings = useCallback(s => { setAppSettings(s); localStorage.setItem('appSettings', JSON.stringify(s)); }, []);
  const [theme, setTheme] = useState('light');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sheetStatus, setSheetStatus] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, id, type }
  const menuTimerRef = useRef(null);
  const [, startTransition] = useTransition();
  const [filterI, setFilterI] = useState({ search:'', manager:'', platform:'', attendance:'', passed:'' });
  const [filterO, setFilterO] = useState({ search:'', manager:'', status:'' });
  const [filterP, setFilterP] = useState({ search:'', manager:'', platform:'', result:'' });

  // 현재 state의 최신값을 insertRow에서 참조하기 위한 ref
  const stateRef = useRef({ interviews: DEFAULT_INTERVIEWS, onboards: DEFAULT_ONBOARDS, proposals: DEFAULT_PROPOSALS, costs: [] });
  useEffect(() => { stateRef.current = { interviews, onboards, proposals, costs }; }, [interviews, onboards, proposals, costs]);

  // 서버에서 데이터 로드 — 실패 시 2초 간격으로 최대 8회 재시도
  useEffect(() => {
    let cancelled = false;
    const tryLoad = async (attempt = 0) => {
      try {
        const { interviews: i, onboards: o, proposals: p, costs: c, jds: j } = await loadData();
        if (cancelled) return;
        startTransition(() => {
          setInterviews(i);
          setOnboards(o);
          setProposals(p);
          if (c) setCosts(c);
          if (j && j.length > 0) setJDs(j);
        });
        setSheetStatus({ msg: '서버에서 데이터를 불러왔습니다.', level: 'success' });
      } catch (err) {
        if (cancelled) return;
        if (attempt < 8) {
          setSheetStatus({ msg: `서버 연결 중... (${attempt + 1}/8)`, level: 'info' });
          setTimeout(() => tryLoad(attempt + 1), 2000);
        } else {
          setSheetStatus({ msg: `서버 연결 실패: ${err.message}`, level: 'error' });
        }
      }
    };
    tryLoad();
    return () => { cancelled = true; };
  }, []);

  // Theme
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  // Close context menu on click
  useEffect(() => {
    const close = () => { setContextMenu(null); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  // ── Update (낙관적 업데이트: UI 즉시 반영 후 서버 저장) ──
  const updateInterview = useCallback((id, field, value) => {
    setInterviews(p => p.map(r => r.id===id ? {...r,[field]:value} : r));
    apiUpdate('interviews', id, { [field]: value }).catch(console.error);
  }, []);
  const updateInterviewType = useCallback((id, type) => {
    const platform = (type==='포지션 제안자' ? appSettings.proposalPlatforms : appSettings.applicantPlatforms)[0] || '사람인';
    setInterviews(p => p.map(r => r.id===id ? {...r, type, platform} : r));
    apiUpdate('interviews', id, { type, platform }).catch(console.error);
  }, [appSettings]);
  const updateOnboard = useCallback((id, field, value) => {
    setOnboards(p => p.map(r => r.id===id ? {...r,[field]:value} : r));
    apiUpdate('onboards', id, { [field]: value }).catch(console.error);
  }, []);
  const updateProposal = useCallback((id, field, value) => {
    setProposals(p => p.map(r => r.id===id ? {...r,[field]:value} : r));
    apiUpdate('proposals', id, { [field]: value }).catch(console.error);
  }, []);
  const updateCost = useCallback((id, field, value) => {
    setCosts(p => p.map(r => r.id===id ? {...r,[field]:value} : r));
    apiUpdate('costs', id, { [field]: value }).catch(console.error);
  }, []);

  // ── Add row (낙관적: 즉시 표시 → 서버 ID로 교체는 startTransition) ──
  const addInterviewRow = useCallback(async () => {
    const tid = -Date.now();
    const row = {id:tid,name:'',contact:'',job:'',type:'지원자',platform:'사람인',date:today(),time:'',interviewer:'',manager:'',status:'면접예정',guided:'',startDate:'',memo:'',attendance:'',passed:''};
    setInterviews(p => [row, ...p]);
    const saved = await apiAdd('interviews', row).catch(console.error);
    if (saved) startTransition(() => setInterviews(p => p.map(r => r.id===tid ? saved : r)));
  }, []);
  const addOnboardRow = useCallback(async () => {
    const tid = -Date.now();
    const row = {id:tid,name:'',contact:'',job:'',date:today(),manager:'',status:'입사 예정',attendance:'',emailCreated:'',flexJoined:'',contractSigned:'',memo:''};
    setOnboards(p => [row, ...p]);
    const saved = await apiAdd('onboards', row).catch(console.error);
    if (saved) startTransition(() => setOnboards(p => p.map(r => r.id===tid ? saved : r)));
  }, []);
  const addProposalRow = useCallback(async () => {
    const tid = -Date.now();
    const row = {id:tid,name:'',contact:'',job:'',platform:'사람인',manager:'',date:today(),result:'대기',memo:''};
    setProposals(p => [row, ...p]);
    const saved = await apiAdd('proposals', row).catch(console.error);
    if (saved) startTransition(() => setProposals(p => p.map(r => r.id===tid ? saved : r)));
  }, []);
  const addCostRow = useCallback(async (vendor='') => {
    const tid = -Date.now();
    const row = {id:tid,category:'채용',vendor:vendor||'',classification:'',amount:0,description:'',note:'',date:today(),period:''};
    setCosts(p => [row, ...p]);
    const saved = await apiAdd('costs', row).catch(console.error);
    if (saved) startTransition(() => setCosts(p => p.map(r => r.id===tid ? saved : r)));
  }, []);

  // ── Context menu ──
  const showMenu = useCallback((e, id, type) => {
    clearTimeout(menuTimerRef.current);
    if (!e) {
      menuTimerRef.current = setTimeout(() => setContextMenu(null), 180);
      return;
    }
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({ x: rect.right+4, y: rect.top-4, id, type });
  }, []);

  const insertRow = useCallback(async (type, refId, pos) => {
    setContextMenu(null);
    const { interviews: iArr, onboards: oArr, proposals: pArr, costs: cArr } = stateRef.current;
    const tid = -Date.now();
    let row, apiType, setter;
    if (type==='interview') {
      const ref = iArr.find(r=>r.id===refId);
      row = {id:tid,name:'',contact:'',job:'',type:'지원자',platform:'사람인',date:ref?.date||today(),time:'',interviewer:'',manager:ref?.manager||'',status:'면접예정',guided:'',startDate:'',memo:'',attendance:'',passed:''};
      apiType = 'interviews'; setter = setInterviews;
    } else if (type==='onboard') {
      const ref = oArr.find(r=>r.id===refId);
      row = {id:tid,name:'',contact:'',job:'',date:ref?.date||today(),manager:ref?.manager||'',status:'입사 예정',attendance:'',emailCreated:'',flexJoined:'',contractSigned:'',memo:''};
      apiType = 'onboards'; setter = setOnboards;
    } else if (type==='cost') {
      const ref = cArr.find(r=>r.id===refId);
      row = {id:tid,category:ref?.category||'채용',vendor:ref?.vendor||'',classification:ref?.classification||'',amount:0,description:'',note:ref?.note||'',date:ref?.date||today(),period:''};
      apiType = 'costs'; setter = setCosts;
    } else {
      const ref = pArr.find(r=>r.id===refId);
      row = {id:tid,name:'',contact:'',job:'',platform:ref?.platform||'사람인',manager:ref?.manager||'',date:ref?.date||today(),result:'대기',memo:''};
      apiType = 'proposals'; setter = setProposals;
    }
    setter(p => { const idx=p.findIndex(r=>r.id===refId); const next=[...p]; next.splice(pos==='above'?idx:idx+1,0,row); return next; });
    const saved = await apiInsert(apiType, row, refId, pos).catch(console.error);
    if (saved) startTransition(() => setter(p => p.map(r => r.id===tid ? saved : r)));
  }, []);

  const copyRow = useCallback((type, id) => {
    setContextMenu(null);
    const { interviews: iArr, onboards: oArr, proposals: pArr, costs: cArr } = stateRef.current;
    const arr = type==='interview'?iArr : type==='onboard'?oArr : type==='cost'?cArr : pArr;
    const setter = type==='interview'?setInterviews : type==='onboard'?setOnboards : type==='cost'?setCosts : setProposals;
    const apiType = type==='interview'?'interviews' : type==='onboard'?'onboards' : type==='cost'?'costs' : 'proposals';
    const ref = arr.find(r=>r.id===id);
    if (!ref) return;
    const tid = -Date.now();
    const { id:_, ...rest } = ref;
    const newRow = {...rest, id:tid};
    setter(p => { const n=[...p]; n.splice(n.findIndex(r=>r.id===id)+1,0,newRow); return n; });
    apiInsert(apiType, rest, id, 'below')
      .then(saved => { if (saved) startTransition(()=>setter(p=>p.map(r=>r.id===tid?saved:r))); })
      .catch(console.error);
  }, []);

  const deleteRow = useCallback((type, id) => {
    setContextMenu(null);
    const setter = type==='interview'?setInterviews : type==='onboard'?setOnboards : type==='cost'?setCosts : setProposals;
    setter(p=>p.filter(r=>r.id!==id));
    const apiType = type==='interview'?'interviews' : type==='onboard'?'onboards' : type==='cost'?'costs' : 'proposals';
    apiDelete(apiType, id).catch(console.error);
  }, []);

  const saveAllJDs = useCallback((rows) => {
    setJDs(rows);
    apiSaveAllJDs(rows).catch(console.error);
  }, []);

  const pageTitles = { dashboard:'대시보드', interview:'면접 일정', onboard:'교육 및 입사자', proposal:'포지션 제안 O/B', cost:'채용 비용', jd:'채용 J/D 관리', settings:'설정' };

  const nav = (p) => { setPage(p); setSidebarOpen(false); };

  const navigateWithFilter = useCallback((targetPage, filters) => {
    if (targetPage === 'interview') {
      setFilterI({ search:'', manager:'', platform:'', attendance:'', passed:'', ...filters });
    } else if (targetPage === 'proposal') {
      setFilterP({ search:'', manager:'', platform:'', result:'', ...filters });
    } else if (targetPage === 'onboard') {
      setFilterO({ search:'', manager:'', status:'', ...filters });
    }
    setPage(targetPage);
    setSidebarOpen(false);
  }, []);

  return (
    <div className="app-wrapper" onClick={()=>setContextMenu(null)}>
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen?'open':''}`}>
        <div className="sidebar-logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="7" fill="var(--color-primary)"/>
            <path d="M8 20V10l6-3 6 3v10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="11" y="14" width="6" height="6" rx="1" stroke="#fff" strokeWidth="1.8"/>
            <path d="M14 14v-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <div>
            <div className="sidebar-logo-text">채용관리</div>
            <div className="sidebar-logo-sub">인사팀 포털</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">메인</div>
          <button className={`nav-item ${page==='dashboard'?'active':''}`} onClick={()=>nav('dashboard')}><LayoutDashboard size={16}/> 대시보드</button>
          <div className="nav-divider"/>
          <div className="nav-section-label">채용 관리</div>
          <button className={`nav-item ${page==='interview'?'active':''}`} onClick={()=>nav('interview')}><CalendarCheck size={16}/> 면접 일정<span className="nav-count">{interviews.length}</span></button>
          <button className={`nav-item ${page==='onboard'?'active':''}`} onClick={()=>nav('onboard')}><UserCheck size={16}/> 교육 및 입사자<span className="nav-count">{onboards.length}</span></button>
          <button className={`nav-item ${page==='proposal'?'active':''}`} onClick={()=>nav('proposal')}><Send size={16}/> 포지션 제안 현황<span className="nav-count">{proposals.length}</span></button>
          <button className={`nav-item ${page==='cost'?'active':''}`} onClick={()=>nav('cost')}><Receipt size={16}/> 채용 비용<span className="nav-count">{costs.length}</span></button>
          <button className={`nav-item ${page==='jd'?'active':''}`} onClick={()=>nav('jd')}><FileText size={16}/> 채용 J/D 관리<span className="nav-count">{jds.filter(r=>r.status==='진행중').length}</span></button>
          <div className="nav-divider"/>
          <button className={`nav-item ${page==='settings'?'active':''}`} onClick={()=>nav('settings')}><Settings size={16}/> 설정</button>
        </nav>
      </aside>
      {sidebarOpen && <div className="sidebar-backdrop open" onClick={()=>setSidebarOpen(false)}/>}

      {/* Main */}
      <div className="main-area">
        <header className="topbar">
          <button className="hamburger" onClick={()=>setSidebarOpen(o=>!o)}><Menu size={18}/></button>
          <div className="topbar-title">{pageTitles[page]}</div>
          <div className="topbar-actions">
            <button className="btn btn-secondary" style={{whiteSpace:'nowrap'}} onClick={async()=>{
              setSheetStatus({msg:'구글 시트에서 동기화 중...', level:'info'});
              try {
                const r = await apiSync();
                const data = await import('@/lib/sheets').then(m => m.loadData());
                setInterviews(data.interviews); setOnboards(data.onboards); setProposals(data.proposals);
                if (data.costs) setCosts(data.costs);
                setSheetStatus({msg:`동기화 완료: 면접 ${r.counts.interviews}건, 입사자 ${r.counts.onboards}건, 제안 ${r.counts.proposals}건`, level:'success'});
              } catch(e) { setSheetStatus({msg:`동기화 실패: ${e.message}`, level:'error'}); }
            }}>🔄 시트 동기화</button>
            <button className="theme-toggle" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>
              {theme==='dark' ? <Sun size={18}/> : <Moon size={18}/>}
            </button>
          </div>
        </header>

        <div className="content-area">
          {page==='dashboard' && <DashboardPage interviews={interviews} onboards={onboards} proposals={proposals} costs={costs} sheetStatus={sheetStatus} theme={theme} appSettings={appSettings} onNavigate={navigateWithFilter}/>}
          {page==='interview' && <InterviewPage data={interviews} filter={filterI} setFilter={setFilterI} onUpdate={updateInterview} onUpdateType={updateInterviewType} onAdd={addInterviewRow} onShowMenu={showMenu} appSettings={appSettings}/>}
          {page==='onboard' && <OnboardPage data={onboards} filter={filterO} setFilter={setFilterO} onUpdate={updateOnboard} onAdd={addOnboardRow} onShowMenu={showMenu} appSettings={appSettings}/>}
          {page==='proposal' && <ProposalPage data={proposals} filter={filterP} setFilter={setFilterP} onUpdate={updateProposal} onAdd={addProposalRow} onShowMenu={showMenu} appSettings={appSettings}/>}
          {page==='cost' && <CostPage data={costs} onUpdate={updateCost} onAdd={addCostRow} onShowMenu={showMenu} appSettings={appSettings}/>}
          {page==='jd' && <JDPage data={jds} onSaveAll={saveAllJDs} costs={costs}/>}
          {page==='settings' && <SettingsPage settings={appSettings} onUpdate={updateAppSettings}/>}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div className="row-context-menu" style={{left:contextMenu.x, top:contextMenu.y}} onClick={e=>e.stopPropagation()} onMouseEnter={()=>clearTimeout(menuTimerRef.current)} onMouseLeave={()=>{menuTimerRef.current=setTimeout(()=>setContextMenu(null),180)}}>
          <button className="rcm-btn" onClick={()=>insertRow(contextMenu.type,contextMenu.id,'above')}>↑ 위에 행 추가</button>
          <button className="rcm-btn" onClick={()=>insertRow(contextMenu.type,contextMenu.id,'below')}>↓ 아래에 행 추가</button>
          <button className="rcm-btn" onClick={()=>copyRow(contextMenu.type,contextMenu.id)}>⎘ 행 복사</button>
          <div className="rcm-divider"/>
          <button className="rcm-btn danger" onClick={()=>deleteRow(contextMenu.type,contextMenu.id)}>✕ 행 삭제</button>
        </div>
      )}
    </div>
  );
}
