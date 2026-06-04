'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, useTransition } from 'react';
import { Chart, registerables } from 'chart.js';
import { LayoutDashboard, CalendarCheck, UserCheck, Send, Menu, Plus, Sun, Moon, Search, Settings, Receipt, FileText, MessageSquare, Clock, AlertTriangle, ClipboardList, Users, BookText } from 'lucide-react';
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

/* ── 날짜 입력: type="text", 숫자만 입력받아 YYYY-MM-DD 자동 포맷, blur 시에만 저장 ── */
function InlineDatePicker({ value, onSave }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && ref.current !== document.activeElement) ref.current.value = value || '';
  }, [value]);

  const handleKeyDown = (e) => {
    if (['Backspace','Delete','Tab','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
    if (!/^\d$/.test(e.key)) { e.preventDefault(); return; }

    e.preventDefault();
    const input = e.target;
    const pos   = input.selectionStart;

    // 커서 앞·뒤의 순수 숫자 추출
    const dBefore = input.value.substring(0, pos).replace(/-/g, '');
    const dAfter  = input.value.replace(/-/g, '').substring(dBefore.length);
    const newD    = (dBefore + e.key + dAfter).substring(0, 8); // 최대 8자리(YYYYMMDD)

    // YYYY-MM-DD 형태로 조합
    let fmt = newD.substring(0, 4);
    if (newD.length > 4) fmt += '-' + newD.substring(4, 6);
    if (newD.length > 6) fmt += '-' + newD.substring(6, 8);

    input.value = fmt;

    // 커서 위치: 삽입된 하이픈 수만큼 보정
    const dp = dBefore.length + 1;
    const cp = dp + (dp > 4 ? 1 : 0) + (dp > 6 ? 1 : 0);
    input.setSelectionRange(cp, cp);
  };

  return (
    <input
      ref={ref}
      className="inline-input"
      type="text"
      placeholder="YYYY-MM-DD"
      maxLength={10}
      defaultValue={value || ''}
      onKeyDown={handleKeyDown}
      onBlur={e => {
        const v = e.target.value.trim();
        if (!v || /^\d{4}-\d{2}-\d{2}$/.test(v)) onSave(v);
        else { e.target.value = value || ''; onSave(value || ''); }
      }}
    />
  );
}

/* ── 시간 입력: type="text", 숫자만 입력받아 HH:MM 자동 포맷, blur 시에만 저장 ── */
function InlineTimePicker({ value, onSave }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && ref.current !== document.activeElement) ref.current.value = value || '';
  }, [value]);

  const handleKeyDown = (e) => {
    if (['Backspace','Delete','Tab','Enter','ArrowLeft','ArrowRight'].includes(e.key)) return;
    if (!/^\d$/.test(e.key)) { e.preventDefault(); return; }

    e.preventDefault();
    const input = e.target;
    const pos   = input.selectionStart;

    const dBefore = input.value.substring(0, pos).replace(/:/g, '');
    const dAfter  = input.value.replace(/:/g, '').substring(dBefore.length);
    const newD    = (dBefore + e.key + dAfter).substring(0, 4); // 최대 4자리(HHMM)

    let fmt = newD.substring(0, 2);
    if (newD.length > 2) fmt += ':' + newD.substring(2, 4);

    input.value = fmt;

    const dp = dBefore.length + 1;
    const cp = dp + (dp > 2 ? 1 : 0);
    input.setSelectionRange(cp, cp);
  };

  return (
    <input
      ref={ref}
      className="inline-input"
      type="text"
      placeholder="HH:MM"
      maxLength={5}
      defaultValue={value || ''}
      onKeyDown={handleKeyDown}
      onBlur={e => {
        const v = e.target.value.trim();
        if (!v || /^\d{2}:\d{2}$/.test(v)) onSave(v);
        else { e.target.value = value || ''; onSave(value || ''); }
      }}
    />
  );
}

/* ── 열 너비 드래그 조정 (table-layout:auto — col width는 최소 너비 힌트) ── */
function useColResize(init) {
  const tbRef = useRef(null);
  const saved = useRef([...init]);
  const grab = useCallback((idx, e) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = saved.current[idx];
    const mv = ev => {
      const w = Math.max(40, w0 + ev.clientX - x0);
      saved.current[idx] = w;
      const table = tbRef.current;
      if (!table) return;
      // th에 직접 min-width + width 적용 (auto layout에서도 열 너비 고정)
      const ths = table.querySelectorAll('thead th');
      if (ths[idx]) {
        ths[idx].style.minWidth = w + 'px';
        ths[idx].style.width    = w + 'px';
      }
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
   PERIOD REPORT MODAL
═══════════════════════════════════════════ */
function PeriodReport({ selMonths, fi, fo, fp, fc, appSettings, onClose }) {
  const pct = (a,b) => b ? Math.round(a/b*100) : 0;

  // 기간 표시
  const sortedM = [...selMonths].sort();
  const periodStr = sortedM.length === 0 ? '선택 없음'
    : sortedM.length === 1 ? fmtMonth(sortedM[0])
    : `${fmtMonth(sortedM[0])} ~ ${fmtMonth(sortedM[sortedM.length-1])} (${sortedM.length}개월)`;

  // 면접 통계
  const totalInt = fi.length;
  const attended = fi.filter(r=>r.attendance==='참석').length;
  const passed   = fi.filter(r=>r.passed==='합격').length;
  const failed   = fi.filter(r=>r.passed==='불합격').length;
  const iNames   = new Set(fi.map(r=>r.name).filter(Boolean));
  const finalHired = fo.filter(r=>r.name && iNames.has(r.name)).length;

  // 플랫폼별 면접
  const platCounts = {};
  appSettings.applicantPlatforms.forEach(p => { platCounts[p]=0; });
  fi.forEach(r => { if(platCounts[r.platform]!=null) platCounts[r.platform]++; });
  const platRows = appSettings.applicantPlatforms.filter(k=>platCounts[k]>0);

  // 포지션 제안
  const ppCounts = {};
  appSettings.proposalPlatforms.forEach(p => { ppCounts[p]=0; });
  fp.forEach(r => { if(ppCounts[r.platform]!=null) ppCounts[r.platform]++; });
  const ppRows = appSettings.proposalPlatforms.filter(k=>ppCounts[k]>0);
  const responded = fp.filter(r=>r.result==='수락'||r.result==='거절').length;
  const accepted  = fp.filter(r=>r.result==='수락').length;

  // 채용 비용
  const totalCost = fc.reduce((s,r)=>s+(Number(r.amount)||0),0);
  const costPerHire = finalHired>0 ? Math.round(totalCost/finalHired) : 0;
  const vendorCosts = {};
  fc.forEach(r=>{ if(r.vendor) vendorCosts[r.vendor]=(vendorCosts[r.vendor]||0)+(Number(r.amount)||0); });

  // 담당자별 면접
  const mgrMap = {};
  fi.forEach(r=>{ if(r.manager) mgrMap[r.manager]=(mgrMap[r.manager]||0)+1; });

  const handlePrint = () => {
    const el = document.getElementById('period-rpt-inner');
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>채용 현황 보고서</title><style>
      body{font-family:sans-serif;padding:32px;color:#111;font-size:13px}
      h1{font-size:20px;margin:0 0 4px} h2{font-size:14px;margin:20px 0 8px;border-bottom:2px solid #111;padding-bottom:4px}
      table{width:100%;border-collapse:collapse;margin-bottom:10px}
      th{background:#f0f0f0;padding:5px 8px;text-align:left;border:1px solid #ccc;font-size:11px}
      td{padding:5px 8px;border:1px solid #ccc;font-size:12px}
      .kpi-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}
      .kpi-box{border:1px solid #ccc;border-radius:6px;padding:10px 14px;min-width:120px}
      .kpi-lbl{font-size:11px;color:#666} .kpi-val{font-size:18px;font-weight:700;margin:2px 0}
      .total-row{font-weight:700;background:#fffbeb}
    </style></head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(()=>w.print(),300);
  };

  const thS={padding:'6px 8px',textAlign:'left',borderBottom:'1px solid var(--color-divider)',background:'var(--color-surface-offset)',fontWeight:600,fontSize:'var(--text-xs)'};
  const tdS=(i)=>({padding:'5px 8px',borderBottom:'1px solid var(--color-divider)',background:i%2===0?'transparent':'var(--color-surface-offset)',fontSize:'var(--text-xs)'});
  const kpiItems=[
    ['면접자',`${totalInt}명`],['면접 참여',`${attended}명 (${pct(attended,totalInt)}%)`],
    ['합격',`${passed}명`],['불합격',`${failed}명`],
    ['최종 입사',`${finalHired}명 (${pct(finalHired,totalInt)}%)`],
    ['포지션 제안',`${fp.length}건`],['제안 수락',`${accepted}건 (${pct(accepted,fp.length)}%)`],
    ['총 채용 비용',fmtAmount(totalCost)],['1인당 비용',finalHired>0?fmtAmount(costPerHire):'-'],
  ];

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:1000,overflowY:'auto',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'24px 16px'}} onClick={onClose}>
      <div style={{background:'var(--color-surface)',borderRadius:12,padding:28,width:'100%',maxWidth:900}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:'var(--text-lg)'}}>선택 기간 채용 현황 보고서</div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-primary" onClick={handlePrint}>🖨️ 인쇄 / PDF</button>
            <button className="btn btn-secondary" onClick={onClose}>✕</button>
          </div>
        </div>

        <div id="period-rpt-inner">
          <h1 style={{margin:'0 0 4px',fontWeight:700}}>채용 현황 보고서</h1>
          <div style={{fontSize:'var(--text-xs)',color:'var(--color-text-muted)',marginBottom:20}}>기간: {periodStr}</div>

          {/* KPI 요약 */}
          <h2 style={{fontWeight:700,fontSize:'var(--text-sm)',marginBottom:10,paddingBottom:4,borderBottom:'2px solid var(--color-divider)'}}>1. 채용 현황 요약</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
            {kpiItems.map(([l,v])=>(
              <div key={l} style={{border:'1px solid var(--color-divider)',borderRadius:6,padding:'10px 14px'}}>
                <div style={{fontSize:'var(--text-xs)',color:'var(--color-text-muted)'}}>{l}</div>
                <div style={{fontSize:'var(--text-base)',fontWeight:700,marginTop:2}}>{v}</div>
              </div>
            ))}
          </div>

          {/* 채용 퍼넬 */}
          <h2 style={{fontWeight:700,fontSize:'var(--text-sm)',marginBottom:10,paddingBottom:4,borderBottom:'2px solid var(--color-divider)'}}>2. 채용 퍼넬</h2>
          <table style={{width:'100%',borderCollapse:'collapse',marginBottom:20}}>
            <thead><tr>{['단계','인원','전환율'].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
            <tbody>
              {[['면접자',totalInt,100],['면접 참여',attended,pct(attended,totalInt)],['합격',passed,pct(passed,attended)],['불합격',failed,pct(failed,attended)],['최종 입사',finalHired,pct(finalHired,passed)]].map(([l,v,p],i)=>(
                <tr key={l}><td style={tdS(i)}>{l}</td><td style={{...tdS(i),textAlign:'right'}}>{v}명</td><td style={{...tdS(i),textAlign:'right'}}>{p}%</td></tr>
              ))}
            </tbody>
          </table>

          {/* 플랫폼별 면접 */}
          {platRows.length>0 && <>
            <h2 style={{fontWeight:700,fontSize:'var(--text-sm)',marginBottom:10,paddingBottom:4,borderBottom:'2px solid var(--color-divider)'}}>3. 플랫폼별 면접 현황</h2>
            <table style={{width:'100%',borderCollapse:'collapse',marginBottom:20}}>
              <thead><tr>{['플랫폼','면접자','비율'].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>
                {platRows.map((k,i)=>(
                  <tr key={k}><td style={tdS(i)}>{k}</td><td style={{...tdS(i),textAlign:'right'}}>{platCounts[k]}명</td><td style={{...tdS(i),textAlign:'right'}}>{pct(platCounts[k],totalInt)}%</td></tr>
                ))}
              </tbody>
            </table>
          </>}

          {/* 포지션 제안 */}
          {ppRows.length>0 && <>
            <h2 style={{fontWeight:700,fontSize:'var(--text-sm)',marginBottom:10,paddingBottom:4,borderBottom:'2px solid var(--color-divider)'}}>4. 포지션 제안 현황</h2>
            <table style={{width:'100%',borderCollapse:'collapse',marginBottom:20}}>
              <thead><tr>{['플랫폼','제안','응답','수락','비율'].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>
                {ppRows.map((k,i)=>{
                  const cnt=ppCounts[k];
                  const r=fp.filter(x=>x.platform===k&&(x.result==='수락'||x.result==='거절')).length;
                  const a=fp.filter(x=>x.platform===k&&x.result==='수락').length;
                  return <tr key={k}><td style={tdS(i)}>{k}</td><td style={{...tdS(i),textAlign:'right'}}>{cnt}</td><td style={{...tdS(i),textAlign:'right'}}>{r}</td><td style={{...tdS(i),textAlign:'right'}}>{a}</td><td style={{...tdS(i),textAlign:'right'}}>{pct(a,cnt)}%</td></tr>;
                })}
                <tr style={{fontWeight:700}}><td style={{padding:'6px 8px',borderTop:'2px solid var(--color-divider)'}}>합계</td><td style={{padding:'6px 8px',borderTop:'2px solid var(--color-divider)',textAlign:'right'}}>{fp.length}</td><td style={{padding:'6px 8px',borderTop:'2px solid var(--color-divider)',textAlign:'right'}}>{responded}</td><td style={{padding:'6px 8px',borderTop:'2px solid var(--color-divider)',textAlign:'right'}}>{accepted}</td><td style={{padding:'6px 8px',borderTop:'2px solid var(--color-divider)',textAlign:'right'}}>{pct(accepted,fp.length)}%</td></tr>
              </tbody>
            </table>
          </>}

          {/* 채용 비용 */}
          {Object.keys(vendorCosts).length>0 && <>
            <h2 style={{fontWeight:700,fontSize:'var(--text-sm)',marginBottom:10,paddingBottom:4,borderBottom:'2px solid var(--color-divider)'}}>5. 채용 비용 현황</h2>
            <table style={{width:'100%',borderCollapse:'collapse',marginBottom:20}}>
              <thead><tr>{['플랫폼','금액','비율'].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>
                {Object.entries(vendorCosts).sort((a,b)=>b[1]-a[1]).map(([v,amt],i)=>(
                  <tr key={v}><td style={tdS(i)}>{v}</td><td style={{...tdS(i),textAlign:'right'}}>{fmtAmount(amt)}</td><td style={{...tdS(i),textAlign:'right'}}>{pct(amt,totalCost)}%</td></tr>
                ))}
                <tr style={{fontWeight:700,background:'var(--color-gold-light)',color:'var(--color-gold)'}}>
                  <td style={{padding:'6px 8px',borderTop:'2px solid var(--color-divider)'}}>합계</td>
                  <td style={{padding:'6px 8px',borderTop:'2px solid var(--color-divider)',textAlign:'right'}}>{fmtAmount(totalCost)}</td>
                  <td style={{padding:'6px 8px',borderTop:'2px solid var(--color-divider)',textAlign:'right'}}>100%</td>
                </tr>
              </tbody>
            </table>
            {finalHired>0 && <div style={{fontSize:'var(--text-xs)',color:'var(--color-text-muted)',textAlign:'right',marginTop:-12,marginBottom:20}}>1인당 채용 비용: <strong>{fmtAmount(costPerHire)}</strong></div>}
          </>}

          {/* 담당자별 */}
          {Object.keys(mgrMap).length>0 && <>
            <h2 style={{fontWeight:700,fontSize:'var(--text-sm)',marginBottom:10,paddingBottom:4,borderBottom:'2px solid var(--color-divider)'}}>6. 담당자별 면접 현황</h2>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['담당자','면접자','비율'].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
              <tbody>
                {Object.entries(mgrMap).sort((a,b)=>b[1]-a[1]).map(([m,cnt],i)=>(
                  <tr key={m}><td style={tdS(i)}>{m}</td><td style={{...tdS(i),textAlign:'right'}}>{cnt}명</td><td style={{...tdS(i),textAlign:'right'}}>{pct(cnt,totalInt)}%</td></tr>
                ))}
              </tbody>
            </table>
          </>}
        </div>
      </div>
    </div>
  );
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
  const [deptFilter, setDeptFilter] = useState('본사');
  // 월 필터
  const [selMonths, setSelMonths] = useState(() => {
    // 기본값: 2026-01 ~ 최신 월
    const defaults = ALL_MONTHS.filter(m => m >= '2026-01');
    return new Set(defaults.length ? defaults : ALL_MONTHS);
  });
  const [showPeriodReport, setShowPeriodReport] = useState(false);
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

      {/* 구성원 현황 차트 (기간 무관) */}
      <WorkerSummaryCard selMonths={selMonths} deptFilter={deptFilter} onlyCharts={true}/>

      {/* 월 필터 */}
      <div className="card" style={{marginBottom:16,padding:'12px 16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <span style={{fontSize:'var(--text-sm)',fontWeight:600,color:'var(--color-text-muted)'}}>기간 선택</span>
          <button className="btn btn-secondary" style={{fontSize:11,padding:'2px 8px'}} onClick={toggleAll}>
            {selMonths.size===ALL_MONTHS.length?'전체 해제':'전체 선택'}
          </button>
          <span style={{fontSize:11,color:'var(--color-text-faint)'}}>({selMonths.size}개월 선택)</span>
          <button className="btn btn-primary" style={{marginLeft:'auto',fontSize:11,padding:'3px 10px'}} onClick={()=>setShowPeriodReport(true)}>📊 선택 기간 보고서</button>
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

      {/* 입퇴사자 현황 (기간 연동) */}
      <WorkerSummaryCard selMonths={selMonths} deptFilter={deptFilter}/>

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

      {showPeriodReport && <PeriodReport selMonths={selMonths} fi={fi} fo={fo} fp={fp} fc={fc} appSettings={appSettings} onClose={()=>setShowPeriodReport(false)}/>}
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
  const { tbRef: iTbRef, grab: iGrab, init: iW } = useColResize([22,88,86,110,72,76,84,68,124,78,86,68,76,84,100]);

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
        <table ref={iTbRef} className="data-table" >
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
                        <td><InlineDatePicker value={r.date} onSave={v=>onUpdate(r.id,'date',v)}/></td>
                        <td><InlineTimePicker value={r.time||''} onSave={v=>onUpdate(r.id,'time',v)}/></td>
                        <td><InlineText value={r.interviewer} onSave={v=>onUpdate(r.id,'interviewer',v)}/></td>
                        <td><select className="inline-select" value={r.manager} onChange={e=>onUpdate(r.id,'manager',e.target.value)}><option value="">선택</option>{appSettings.managers.map(m=><option key={m}>{m}</option>)}</select></td>
                        <td><select className="inline-select" value={r.attendance||''} onChange={e=>onUpdate(r.id,'attendance',e.target.value)}><option value="">-</option><option>확인중</option><option>불참</option><option>참석확인</option><option>참석</option></select></td>
                        <td><select className="inline-select" value={r.passed||''} onChange={e=>onUpdate(r.id,'passed',e.target.value)}><option value="">-</option><option>불합격</option><option>합격</option></select></td>
                        <td><select className="inline-select" value={r.guided||''} onChange={e=>onUpdate(r.id,'guided',e.target.value)}><option value="">-</option><option>안내완료</option><option>미안내</option></select></td>
                        <td><InlineDatePicker value={r.startDate||''} onSave={v=>onUpdate(r.id,'startDate',v)}/></td>
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
        <table ref={oTbRef} className="data-table" >
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
                      <td><InlineDatePicker value={r.date} onSave={v=>onUpdate(r.id,'date',v)}/></td>
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
        <table ref={pTbRef} className="data-table" >
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
                      <td><InlineDatePicker value={r.date} onSave={v=>onUpdate(r.id,'date',v)}/></td>
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
        <table ref={cTbRef} className="data-table" >
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
const PLAT_KEYS     = ['saramin','jobkorea','albamon','wanted','remember'];
const PLAT_LABELS   = { saramin:'사람인', jobkorea:'잡코리아', albamon:'알바몬', wanted:'원티드', remember:'리멤버' };
const PLAT_VARIABLE = ['wanted','remember']; // 연봉 % 수수료 플랫폼

function CostPlanReport({ activeJDs, periods, plan, onClose }) {
  const parseAmt = t => { if(!t||!t.trim()||t.trim()==='-') return 0; const n=Number(t.replace(/[^0-9]/g,'')); return isNaN(n)?0:n; };
  const totals = {};
  PLAT_KEYS.forEach(k => { totals[k] = activeJDs.reduce((s,r) => s+parseAmt((plan[r.id]||{})[k]), 0); });
  const fixedTotal = PLAT_KEYS.filter(k=>!PLAT_VARIABLE.includes(k)).reduce((s,k)=>s+(totals[k]||0), 0);
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
            진행중 포지션 {activeJDs.length}개 · 총 예상 비용 {fmtAmount(fixedTotal)} + α
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
                  <td colSpan={PLAT_KEYS.length} style={{padding:'7px 8px',textAlign:'right',fontSize:'var(--text-sm)'}}>{fmtAmount(fixedTotal)} + α</td>
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
              {PLAT_KEYS.filter(k=>!PLAT_VARIABLE.includes(k)&&totals[k]>0).sort((a,b)=>totals[b]-totals[a]).map((k,i)=>(
                <tr key={k}>
                  <td style={tdS(i)}>{PLAT_LABELS[k]}</td>
                  <td style={{...tdS(i),textAlign:'right'}}>{fmtAmount(totals[k])}</td>
                  <td style={{...tdS(i),textAlign:'right'}}>{fixedTotal>0?Math.round(totals[k]/fixedTotal*100):0}%</td>
                </tr>
              ))}
              {PLAT_VARIABLE.map((k,i)=>{
                const idx = PLAT_KEYS.filter(p=>!PLAT_VARIABLE.includes(p)&&totals[p]>0).length + i;
                return (
                  <tr key={k}>
                    <td style={tdS(idx)}>{PLAT_LABELS[k]}</td>
                    <td style={{...tdS(idx),textAlign:'right',fontStyle:'italic',color:'var(--color-text-muted)'}}>연봉 7%</td>
                    <td style={{...tdS(idx),textAlign:'right'}}>-</td>
                  </tr>
                );
              })}
              <tr style={{fontWeight:700}}>
                <td style={{padding:'6px 8px',borderTop:'2px solid var(--color-divider)'}}>합계</td>
                <td style={{padding:'6px 8px',borderTop:'2px solid var(--color-divider)',textAlign:'right'}}>{fmtAmount(fixedTotal)} + α</td>
                <td style={{padding:'6px 8px',borderTop:'2px solid var(--color-divider)',textAlign:'right'}}>-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   GUIDE PAGE
═══════════════════════════════════════════ */
const INITIAL_GUIDE_TEMPLATES = [
  { id:'s1', title:'1] 첫 컨택 (재직 중일 때)', items:[
    { id:'i1', title:'1) 지원자', content:`< (주)퍼플페퍼 회신 요청 >

안녕하세요 OOO님, (주)퍼플페퍼 인사담당자입니다.

먼저, 저희 채용에 관심가져 주시고 'OOOO' 직무에 지원해 주셔서 감사드립니다.

현재 재직중이셔서 문자로 남겨드리오니, 편하신 시간에 이 번호로 전화부탁드립니다.

감사합니다 : )` },
    { id:'i2', title:'2) 포지션 제안자', content:`< (주)퍼플페퍼 회신 요청 >

안녕하세요 OOO님, (주)퍼플페퍼 인사담당자입니다.

먼저, 잡코리아를 통한 저희의 제안에 긍정적으로 바라봐 주셔서 대단히 감사드립니다.

현재 재직중이셔서 문자로 남겨드리오니, 편하신 시간에 이 번호로 전화부탁드립니다.

감사합니다 : )` },
  ]},
  { id:'s2', title:'2] 첫 컨택 (부재 중일 때)', items:[
    { id:'i3', title:'1) 지원자', content:`< (주)퍼플페퍼 회신 요청 >

안녕하세요 OOO님, (주)퍼플페퍼 인사담당자입니다.

먼저, 저희 채용에 관심가져 주시고 'OOOO' 직무에 지원해 주셔서 감사드립니다.

현재 부재중이셔서 문자로 남겨드리오니, 편하신 시간에 이 번호로 전화부탁드립니다.

감사합니다 : )` },
    { id:'i4', title:'2) 포지션 제안자', content:`< (주)퍼플페퍼 회신 요청 >

안녕하세요 OOO님, (주)퍼플페퍼 인사담당자입니다.

먼저, 잡코리아를 통한 저희의 제안에 긍정적으로 바라봐 주셔서 대단히 감사드립니다.

현재 부재중이셔서 문자로 남겨드리오니, 편하신 시간에 이 번호로 전화부탁드립니다.

감사합니다 : )` },
  ]},
  { id:'s3', title:'3] 면접 안내', items:[
    { id:'i5', title:'1) PD 관련 직무 (브랜드 SNS 계정 공유)', content:`< (주)퍼플페퍼 면접 전형 안내 >

안녕하세요 OOO님, (주)퍼플페퍼 인사팀입니다.

만나뵙고 인사드릴 기회를 주셔서 대단히 감사드립니다!

아래와 같이 면접 일정을 안내드리오니, 확인 부탁드립니다.

▶ 면접 직무 : OOOO

▶ 면접 일시 : 2026년 OO월 OO일 O요일 OO시

▶ 면접 장소 : 서울특별시 마포구 와우산로 17길 19-18 2층
>> 도착하셔서 전화주시면 안내 도와드리겠습니다!

▶ 주차장 입구가 매우 협소하오니 되도록 대중교통 이용해 주시면 감사드립니다.

▶ 면접 복장 : 편한 복장

▶ 포트폴리오 : 추가로 제출하실 포트폴리오가 있으시다면, hr@pppp.im으로 보내주시면 감사드립니다.

궁금한 부분이 있으시면 언제든지 이 번호로 연락 부탁드립니다.


감사합니다 : )

● (주)퍼플페퍼 홈페이지: https://www.pppp.im/
● 관련 기사 1: https://www.joongang.co.kr/article/25287132
● 관련 기사 2: https://www.kmib.co.kr/article/view.asp?arcid=0029484834&code=61171811&cp=nv

• 코브: https://www.instagram.com/plzlovecov/
• 육지: https://www.instagram.com/plzloveyookji/
• 인플루언서 [무재한]: https://www.instagram.com/pppp_jaehan/
• 인플루언서 [마부장]: https://www.instagram.com/ma_bujang/
• 온라인 매거진 [FAVO]: https://www.instagram.com/favokorea/


-(주)퍼플페퍼 인사팀 올림-` },
    { id:'i6', title:'2) 일반 직무', content:`< (주)퍼플페퍼 면접 전형 안내 >

안녕하세요 OOO님, (주)퍼플페퍼 인사팀입니다.

만나뵙고 인사드릴 기회를 주셔서 대단히 감사드립니다!

아래와 같이 면접 일정을 안내드리오니, 확인 부탁드립니다.

▶ 면접 직무 : OOOO

▶ 면접 일시 : 2026년 OO월 OO일 O요일 OO시

▶ 면접 장소 : 서울특별시 마포구 와우산로 17길 19-18 2층
> 도착하셔서 전화주시면 안내 도와드리겠습니다!

▶ 현재 1층과 주차장이 공사중이므로 대중교통 이용 부탁드리며, 사옥 앞에 도착하시면 전화 부탁드립니다.

▶ 면접 복장 : 편한 복장

궁금한 부분이 있으시면 언제든지 이 번호로 연락 부탁드립니다.


감사합니다 : )

● (주)퍼플페퍼 홈페이지: https://www.pppp.im/
● 관련 기사 1: https://www.joongang.co.kr/article/25287132
● 관련 기사 2: https://www.thebigdata.co.kr/view.php?ud=2025040915475792436cf2d78c68_23
● 관련 기사 3: https://www.donga.com/news/Economy/article/all/20260305/133472493/1

-(주)퍼플페퍼 인사팀 올림-` },
  ]},
  { id:'s4', title:'4] 면접 합격 및 처우 협의', items:[
    { id:'i7', title:'1) 이메일 안내', content:`안녕하세요 OOO님, (주)퍼플페퍼 인사담당자입니다.

먼저, 당사 채용에 관심을 가져주시고 긍정적으로 생각해 주셔서 진심으로 감사드립니다.

면접 전형 결과  '합격'입니다.

진행하신 모든 인터뷰를 성공적으로 마치셨기에, 처우 협의 등 다음 채용 프로세스를 진행하고자 아래 내용을 안내드립니다.

다만, 본 메일은 최종 합격을 확정하는 내용은 아니며, 최종 합격 여부는 처우 협의가 완료된 이후 확정됨을 안내드립니다.

※ 향후 채용 프로세스 요약
1. 처우 협의를 위한 서류를 제출해 주세요.

2. 서류 검토 후, 후보자님께 오퍼레터 메일을 발송드립니다. (서류 제출일로부터 3일 이내 소요)

3. 오퍼레터 검토 후, 입사 일자를 조율합니다.

4. 내용 검토 확인 후, 최종 합격 및 입사가 확정됩니다.

■ 제출 서류 안내
아래 서류를 준비하시어 본 메일로 회신 부탁드립니다.

1. 연봉 관련 서류
 - 최근 연도 연봉계약서 (2025년/2026년)
 - 최근 연도 소득자별 근로소득원천징수부 또는 갑근세 납입증명서
 - 최근 3개월 급여명세서 (기본급, 능력급, 식대 등 항목별로 표기된 상세 내역)
 - 당해 연도 성과급(인센티브) 내역 증빙자료
※ 별도 서류 또는 통장사본 제출로 증빙해주시기 바랍니다.

2. 고용보험 자격 이력 내역서
(※ 공동인증서 로그인 필요 /  https://total.kcomwel.or.kr)
 - [개인] → 고용/산재보험 자격 이력 내역서 선택
 - 보험구분: 고용 / 조회구분: 상용 선택 후 조회
 - 자격관리 상세이력 선택 → 자격 이력 내역서 신청 후 증명원 출력
→ PDF 또는 JPG 파일로 회신 바랍니다.
→ 고용보험에 기재되지 않은 경력은 별도 경력증명서를 함께 제출해 주세요.

3. 비자 증명서(외국인일 경우)

※ 보훈 대상자인 경우, 미리 관련 내용을 공유 부탁드립니다.
※ 서류 제출은 **OO월 OO일(O요일) 11시**까지 완료 부탁드립니다. (준비에 어려움이 있을 경우 반드시 사전에 연락 바랍니다)

기타 문의사항이 있으시면 언제든지 편하게 연락주시기 바랍니다.

감사합니다.` },
    { id:'i8', title:'2) 문자 안내', content:`[퍼플페퍼 채용] 처우 협의 및 후속 채용 절차 안내

안녕하세요 OOO님, (주)퍼플페퍼 인사담당자입니다.

먼저, 당사 채용에 관심을 가져주시고 긍정적으로 생각해 주셔서 진심으로 감사드립니다.

면접 전형 결과  '합격'입니다.

진행하신 모든 인터뷰를 성공적으로 마치셨기에, 처우 협의 등 다음 채용 프로세스를 진행하고자 메일로 안내드렸으니 확인 후 회신 부탁드립니다.

- 메일 주소 :

감사합니다.

* 본 문자는 최종 합격을 확정하는 내용은 아니며, 최종 합격 여부는 처우 협의가 완료된 이후 확정됨을 안내드립니다.` },
  ]},
  { id:'s5', title:'5] 처우협의 최종 및 입사 안내', items:[
    { id:'i9', title:'1) 이메일 안내', content:`< (주)퍼플페퍼 채용 전형 결과 안내 >

안녕하세요 OOO님, (주)퍼플페퍼 인사담당자입니다.

OOO님은 퍼플페퍼 'OOOO' 직무에 '최종 합격'되셨습니다.

하기와 같이 입사일과 추가 제출서류를 안내드리오니 입사일 전까지 회신 부탁드립니다.
(첨부파일 확인)

1) 처우 안내
- 직무 : OOOO
- 연봉 : OOOO만원
- 근무지 : (주)퍼플페퍼 본사, 서울특별시 마포구 와우산로17길 19-18
- 입사 예정일 : 2026년 OO월 OO일 O요일
- 첫 출근일 출근시간 : 오전 10시 30분 (2층으로 오시면 됩니다)
※ 입사 후 3개월 간의 시용 기간이 있으며, 이 기간 동안 시용 평가가 진행됩니다. 평가 결과에 따라 정규직 전환 여부가 결정됩니다.

2) 첫 출근일 출근시간 : 오전 10시 30분

3) 업무 시 사용하실 PC : 업무 상 필요하신 PC 스펙이 있으시면 말씀 주세요. 특이사항 없으시면 일반 사무용 PC로 준비하겠습니다.

4) 추가 필요 서류 : 주민등록등본, 최종 학력 졸업증명서, 비자 증명서(외국인일 경우), 통장사본 (부양가족 있으시다면 말씀 부탁드립니다)

※ 제출하신 서류의 내용이 채용과정에서 진술하신 내용과 다른 경우 채용이 취소될 수 있습니다.

더 궁금한 사항이 있으시면 언제든지 편하게 문의주시고 오퍼에 대한 확답은 2026년 OO월 OO일 O요일 11시까지 회신 부탁드립니다.

다시 한번 귀하의 관심에 감사드립니다.

감사합니다 : )` },
    { id:'i10', title:'2) 문자 안내', content:`[퍼플페퍼 채용] 채용 전형 결과 안내

안녕하세요 OOO님, (주)퍼플페퍼 인사담당자입니다.

(주)퍼플페퍼 채용 전형 결과가 아래의 이메일로 안내드리오니 확인 후 회신 부탁드립니다.

- 메일 주소 :

감사합니다.` },
  ]},
  { id:'s6', title:'6] 면접 전형 탈락', items:[
    { id:'i11', title:'안내 문자', content:`< (주)퍼플페퍼 면접 전형 결과 안내 >

안녕하세요 OOO님, (주)퍼플페퍼 인사담당자입니다.

먼저, (주)퍼플페퍼 채용에 관심을 가져주시고 귀중한 시간을 내주셔서 진심으로 감사드립니다.

OOO님이 내어 주신 시간의 가치를 잘 알기에 관련 담당자들과 다방면으로 고려하였으나,
아쉽게도 이번 채용에서는 합격의 소식을 전해드리지 못하게 되었습니다.

인터뷰에서 보여주신 역량은 매우 훌륭하셨습니다.
하지만 정말 많은 분들 속에서 소수를 선발할 수 밖에 없었던 점을 꼭 알아주셨으면 좋겠습니다.

이번이 마지막 기회는 아니라고 생각합니다.
이후 좋은 인연으로 다시 만나뵐 수 있도록, 저희 (주)퍼플페퍼는 더욱 빠르게 성장하여 다음에는 더욱 많은 분들을 모실 수 있도록 하겠습니다.

지금까지 보여주신 관심과 열정에 감사드리며,
추후 더 좋은 기회로 다시 인연이 닿기를 진심으로 기원합니다.

다시 한 번 소중한 시간을 내어 주신 점에 깊이 감사드립니다.

감사합니다.

(주)퍼플페퍼 인사담당자 올림` },
  ]},
  { id:'s7', title:'7] 면접 참석 확인', items:[
    { id:'i12', title:'안내 문자', content:`< (주)퍼플페퍼 면접 참석 확인 요청 >

안녕하세요, (주)퍼플페퍼 인사팀입니다.

금일 면접 참석 확인 차 연락드리오니, 확인 후 회신하여 주시면 감사드립니다.


감사합니다 : )` },
  ]},
];

function GuidePage() {
  const [sections, setSections] = useState(() =>
    JSON.parse(localStorage.getItem('guideTemplates') || 'null') || INITIAL_GUIDE_TEMPLATES
  );
  const [toast, setToast] = useState(false);
  const dragRef = useRef({ type: null, sectionId: null, itemId: null, fromSectionId: null });
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  const save = (next) => {
    setSections(next);
    localStorage.setItem('guideTemplates', JSON.stringify(next));
  };

  const updateSectionTitle = (sid, value) => {
    save(sectionsRef.current.map(s => s.id === sid ? { ...s, title: value } : s));
  };
  const updateItemTitle = (itemId, value) => {
    save(sectionsRef.current.map(s => ({ ...s, items: s.items.map(i => i.id === itemId ? { ...i, title: value } : i) })));
  };
  const updateContent = (itemId, value) => {
    save(sectionsRef.current.map(s => ({ ...s, items: s.items.map(i => i.id === itemId ? { ...i, content: value } : i) })));
  };

  // 새 ID 생성
  const newId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;

  const moveSection = (sid, dir) => {
    const arr = [...sectionsRef.current];
    const idx = arr.findIndex(s => s.id === sid);
    const to  = idx + dir;
    if (to < 0 || to >= arr.length) return;
    [arr[idx], arr[to]] = [arr[to], arr[idx]];
    save(arr);
  };

  const addSection = () => {
    const next = [...sectionsRef.current, { id: newId('s'), title: '새 전형', items: [{ id: newId('i'), title: '새 항목', content: '' }] }];
    save(next);
  };

  const deleteSection = (sid) => {
    if (!confirm('이 섹션을 삭제하시겠습니까?')) return;
    save(sectionsRef.current.filter(s => s.id !== sid));
  };

  const addItem = (sid) => {
    save(sectionsRef.current.map(s =>
      s.id !== sid ? s : { ...s, items: [...s.items, { id: newId('i'), title: '새 항목', content: '' }] }
    ));
  };

  const deleteItem = (sid, itemId) => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return;
    save(sectionsRef.current.map(s =>
      s.id !== sid ? s : { ...s, items: s.items.filter(i => i.id !== itemId) }
    ));
  };

  const copyItem = (itemId) => {
    let txt = '';
    sectionsRef.current.forEach(s => s.items.forEach(i => { if (i.id === itemId) txt = i.content; }));
    navigator.clipboard.writeText(txt).then(() => {
      setToast(true);
      setTimeout(() => setToast(false), 1800);
    });
  };

  // Section drag — only grip icon is draggable
  const onSectionDragStart = (e, sid) => {
    dragRef.current = { type: 'section', sectionId: sid, itemId: null, fromSectionId: null };
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  };
  const onSectionDragOver = (e, sid) => {
    if (dragRef.current.type !== 'section' || dragRef.current.sectionId === sid) return;
    e.preventDefault();
    e.currentTarget.style.outline = '2px dashed var(--color-primary)';
  };
  const onSectionDragLeave = (e) => { e.currentTarget.style.outline = ''; };
  const onSectionDrop = (e, targetSid) => {
    e.currentTarget.style.outline = '';
    if (dragRef.current.type !== 'section' || dragRef.current.sectionId === targetSid) return;
    e.preventDefault();
    const next = [...sectionsRef.current];
    const fi = next.findIndex(s => s.id === dragRef.current.sectionId);
    const ti = next.findIndex(s => s.id === targetSid);
    const [m] = next.splice(fi, 1);
    next.splice(ti, 0, m);
    dragRef.current = { type: null };
    save(next);
  };

  // Item drag — only grip icon is draggable
  const onItemDragStart = (e, sid, iid) => {
    dragRef.current = { type: 'item', sectionId: sid, itemId: iid, fromSectionId: sid };
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  };
  const onItemDragOver = (e, sid, iid) => {
    if (dragRef.current.type !== 'item' || dragRef.current.itemId === iid) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.style.outline = '2px dashed var(--color-primary)';
  };
  const onItemDragLeave = (e) => { e.currentTarget.style.outline = ''; };
  const onItemDrop = (e, targetSid, targetIid) => {
    e.currentTarget.style.outline = '';
    if (dragRef.current.type !== 'item') return;
    e.preventDefault();
    e.stopPropagation();
    const next = sectionsRef.current.map(s => ({ ...s, items: [...s.items] }));
    const fromSec = next.find(s => s.id === dragRef.current.fromSectionId);
    const toSec = next.find(s => s.id === targetSid);
    if (!fromSec || !toSec) return;
    const fi = fromSec.items.findIndex(i => i.id === dragRef.current.itemId);
    const ti = toSec.items.findIndex(i => i.id === targetIid);
    if (fi < 0 || ti < 0) return;
    const [m] = fromSec.items.splice(fi, 1);
    toSec.items.splice(ti, 0, m);
    dragRef.current = { type: null };
    save(next);
  };

  const titleInputStyle = (bold) => ({
    flex: 1, border: 'none', background: 'transparent',
    color: 'var(--color-text)', outline: 'none', cursor: 'text',
    padding: '0 4px', borderRadius: 3, fontFamily: 'inherit',
    fontWeight: bold ? 700 : 600,
    fontSize: bold ? 'var(--text-base)' : 'var(--text-sm)',
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">채용 안내</div>
          <div className="page-desc">전형별 안내 문자·이메일 템플릿 — ⠿ 드래그로 순서 변경, 제목 클릭으로 수정</div>
        </div>
        <button className="btn btn-primary" onClick={addSection}>
          <Plus size={14}/> 전형 추가
        </button>
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:16 }}>
        {sections.map(s => (
          <div key={s.id}
            style={{ flex: s.items.length === 1 ? '1 1 420px' : '1 1 100%', minWidth:0, background:'var(--color-surface)', border:'1px solid var(--color-divider)', borderRadius:'var(--radius-lg)', boxShadow:'var(--color-shadow-sm)', overflow:'hidden' }}
            onDragOver={e => onSectionDragOver(e, s.id)}
            onDragLeave={onSectionDragLeave}
            onDrop={e => onSectionDrop(e, s.id)}
          >
            {/* Section header */}
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 16px', background:'var(--color-surface-offset)', borderBottom:'1px solid var(--color-divider)' }}>
              <span
                draggable
                onDragStart={e => onSectionDragStart(e, s.id)}
                style={{ color:'var(--color-text-faint)', fontSize:16, letterSpacing:-1, cursor:'grab', flexShrink:0, lineHeight:1 }}
              >⠿</span>
              <input
                key={s.id + '-title'}
                defaultValue={s.title}
                onBlur={e => updateSectionTitle(s.id, e.target.value)}
                onFocus={e => e.target.style.background='var(--color-primary-light)'}
                onBlurCapture={e => e.target.style.background='transparent'}
                style={titleInputStyle(true)}
              />
              <button className="btn btn-sm" style={{ flexShrink:0, color:'var(--color-text-faint)', padding:'3px 6px', fontSize:'var(--text-xs)' }}
                title="위로 이동" onClick={() => moveSection(s.id, -1)}>↑</button>
              <button className="btn btn-sm" style={{ flexShrink:0, color:'var(--color-text-faint)', padding:'3px 6px', fontSize:'var(--text-xs)' }}
                title="아래로 이동" onClick={() => moveSection(s.id, 1)}>↓</button>
              <button className="btn btn-sm" style={{ flexShrink:0, background:'var(--color-primary-light)', color:'var(--color-primary)', padding:'3px 10px', fontSize:'var(--text-xs)' }}
                onClick={() => addItem(s.id)}>+ 항목 추가</button>
              <button className="btn btn-sm" style={{ flexShrink:0, color:'var(--color-error)', opacity:0.7, padding:'3px 8px', fontSize:'var(--text-xs)' }}
                onClick={() => deleteSection(s.id)}>✕</button>
            </div>
            {/* Items */}
            <div style={{ display:'flex', flexDirection:'row', flexWrap:'wrap', gap:12, padding:12 }}>
              {s.items.map(item => (
                <div key={item.id}
                  style={{ flex:'1 1 360px', minWidth:0, background:'var(--color-surface-2)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', overflow:'hidden' }}
                  onDragOver={e => onItemDragOver(e, s.id, item.id)}
                  onDragLeave={onItemDragLeave}
                  onDrop={e => onItemDrop(e, s.id, item.id)}
                >
                  {/* Item header */}
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', background:'var(--color-surface)', borderBottom:'1px solid var(--color-divider)' }}>
                    <span
                      draggable
                      onDragStart={e => onItemDragStart(e, s.id, item.id)}
                      style={{ color:'var(--color-text-faint)', fontSize:14, letterSpacing:-1, cursor:'grab', flexShrink:0, lineHeight:1 }}
                    >⠿</span>
                    <input
                      key={item.id + '-title'}
                      defaultValue={item.title}
                      onBlur={e => updateItemTitle(item.id, e.target.value)}
                      onFocus={e => e.target.style.background='var(--color-primary-light)'}
                      onBlurCapture={e => e.target.style.background='transparent'}
                      style={titleInputStyle(false)}
                    />
                  </div>
                  <div style={{ padding:12 }}>
                    <textarea
                      key={item.id + '-content'}
                      defaultValue={item.content}
                      onBlur={e => updateContent(item.id, e.target.value)}
                      style={{ width:'100%', minHeight:130, border:'1px solid var(--color-border)', borderRadius:'var(--radius-sm)', padding:12, fontSize:'var(--text-sm)', lineHeight:1.7, background:'var(--color-surface)', color:'var(--color-text)', resize:'vertical', fontFamily:'inherit', outline:'none' }}
                      onFocus={e => e.target.style.borderColor='var(--color-primary)'}
                      onBlurCapture={e => e.target.style.borderColor='var(--color-border)'}
                    />
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
                      <button
                        onClick={() => deleteItem(s.id, item.id)}
                        style={{ fontSize:'var(--text-xs)', color:'var(--color-error)', opacity:0.6, background:'none', border:'none', cursor:'pointer', padding:'4px 8px' }}
                      >삭제</button>
                      <button
                        onClick={() => copyItem(item.id)}
                        style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'4px 14px', borderRadius:'var(--radius-sm)', fontSize:'var(--text-xs)', fontWeight:600, background:'var(--color-primary-light)', color:'var(--color-primary)', border:'none', cursor:'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background='var(--color-primary)'; e.currentTarget.style.color='#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='var(--color-primary-light)'; e.currentTarget.style.color='var(--color-primary)'; }}
                      >복사</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {toast && (
        <div style={{ position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)', background:'#1a1a1a', color:'#fff', padding:'7px 20px', borderRadius:999, fontSize:'var(--text-sm)', fontWeight:600, zIndex:9999, pointerEvents:'none' }}>
          복사됨! ✓
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   WORKER PAGE (근로자명부)
═══════════════════════════════════════════ */
const WORKER_SHEET_ID = '1xpLBVZoEz3NDTeYGu0xCuGq_Xy97IgwT2O_3D9PnwC4';
const WORKER_SHEETS = [
  {sheetName:'퍼플_재직',    company:'PPPP',    status:'재직'},
  {sheetName:'퍼플_퇴직',    company:'PPPP',    status:'퇴직'},
  {sheetName:'영업본부_명부', company:'영업본부', status:'재직'},
  {sheetName:'그랑디르_재직', company:'그랑디르', status:'재직'},
  {sheetName:'교도리_재직',  company:'교도리',  status:'재직'},
  {sheetName:'PZPZ_재직',   company:'PZPZ',   status:'재직'},
];
const WORKER_COMPANIES = ['PPPP','영업본부','그랑디르','교도리','PZPZ'];

// 시트별 처리 규칙
// 헤더 매칭 (부분 일치 + NO/이름 동의어)
function matchHeader(header, term) {
  const h = (header||'').toLowerCase().trim();
  const t = term.toLowerCase().trim();
  if (h === t) return true;
  if (h.includes(t)) return true;
  // 동의어
  if ((t==='no'||t==='no.') && (h==='번호'||h==='no.'||h==='no'||h==='#'||h==='순번'||h==='순서')) return true;
  if (t==='이름' && (h==='성명'||h==='이 름'||h.includes('성명'))) return true;
  if (t==='직책' && (h==='직급'||h==='직위'||h.includes('직'))) return true;
  return false;
}

const SHEET_RULES = {
  'PPPP_재직': {
    addGenderAge: true,
    includeTerms: ['NO','본부','팀','직무','이름','입사일자'],
    excludeNames: ['김민지'],
  },
  'PPPP_퇴직': {
    addGenderAge: false,
    includeTerms: ['NO','부서','이름','입사일자','퇴사일자','퇴사사유'],
    addRetiredCol: true,
  },
  '영업본부_재직': {
    addGenderAge: true,
    includeTerms: ['NO','본부','본부장','이름','위촉일자'],
    statusLabel: '위촉',
  },
  '영업본부_퇴직': {
    addGenderAge: false,
    skipRows: 9,
    renameHeaders: {'*지인 제외':'본부','*26/01/26 이후 기준':'본부장','*투입 인원 대비':'이름','*투입 입원':'이름'},
    includeTerms: ['본부','본부장','이름','위촉일자','해촉일자'],
  },
  '그랑디르_재직': {
    addGenderAge: true,
    includeTerms: ['NO','본부','직급','이름','입사일자'],
  },
  '그랑디르_퇴직': {
    addGenderAge: false,
    includeTerms: ['NO','팀','직급','이름','입사일자','퇴사일자','퇴사사유'],
    addRetiredCol: true,
  },
  '교도리_재직': {
    addGenderAge: true,
    includeTerms: ['NO','본부','팀','직급','이름','입사일자'],
  },
  '교도리_퇴직': {
    addGenderAge: false,
    includeTerms: ['NO','부서','팀','직책','이름','입사일자','퇴사일자','퇴사사유'],
    addRetiredCol: true,
  },
  'PZPZ_재직': {
    addGenderAge: true,
    includeTerms: ['NO','부서','팀','직책','이름','입사일자'],
  },
  'PZPZ_퇴직': {
    addGenderAge: false,
    includeTerms: ['NO','부서','팀','직책','이름','입사일자','퇴사일자','퇴사사유'],
    addRetiredCol: true,
  },
};

// 주민번호 → 성별/나이
function calcGenderAge(val) {
  if (!val) return null;
  const clean = String(val).replace(/[-\s]/g, '');
  if (clean.length < 7 || !/^\d+$/.test(clean.slice(0,6))) return null;
  const g = parseInt(clean[6]);
  const gender = [1,3,5,7,9].includes(g) ? '남' : [2,4,6,8,0].includes(g) ? '여' : '';
  const yy = parseInt(clean.slice(0,2));
  const year = g<=2 ? 1900+yy : g<=4 ? 2000+yy : 1800+yy;
  const mm = parseInt(clean.slice(2,4)), dd = parseInt(clean.slice(4,6));
  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth()+1 < mm || (today.getMonth()+1 === mm && today.getDate() < dd)) age--;
  return { gender, age: String(age) };
}

// 시트 데이터 후처리
function applySheetRules(key, rawHeaders, rawRows) {
  const rules = SHEET_RULES[key];
  if (!rules) return { headers: rawHeaders, rows: rawRows };

  let headers = [...rawHeaders];
  let rows = rawRows.map(r => [...r]);

  // 행 스킵
  if (rules.skipRows > 0) rows = rows.slice(rules.skipRows);

  // 헤더 이름 변경
  if (rules.renameHeaders) {
    headers = headers.map(h => {
      const found = Object.entries(rules.renameHeaders).find(([k]) => h.includes(k));
      return found ? found[1] : h;
    });
  }

  // 주민번호 열 자동 탐지
  let residentIdx = headers.findIndex(h => h.includes('주민') || h.includes('등록번호'));
  if (residentIdx < 0) {
    for (let ci = 0; ci < headers.length; ci++) {
      const samples = rows.slice(0,10).map(r => String(r[ci]||'').trim()).filter(Boolean);
      if (samples.length > 0 && samples.some(v =>
        /^\d{6}[-]?\d{7}$/.test(v) || /^\d{13}$/.test(v)
      )) { residentIdx = ci; break; }
    }
  }

  // 포함할 열 인덱스 결정 (includeTerms 기반, 순서 유지)
  let idxs = headers.map((_,i) => i);

  if (rules.includeTerms?.length) {
    const mapped = rules.includeTerms.map(term => {
      const idx = headers.findIndex(h => matchHeader(h, term));
      return idx;
    }).filter(i => i >= 0);
    // 중복 제거, 순서 유지
    idxs = [...new Set(mapped)];
  } else if (rules.excludeContains?.length) {
    idxs = idxs.filter(i => !rules.excludeContains.some(ex => headers[i].includes(ex)));
  }

  // 주민번호 열은 표시에서 제외
  if (residentIdx >= 0) idxs = idxs.filter(i => i !== residentIdx);

  // 퇴사일자 열 탐지 및 추가
  let retiredIdx = -1;
  if (rules.addRetiredCol) {
    retiredIdx = headers.findIndex(h => h.includes('퇴사') || h.includes('퇴직') || h.includes('해촉') && h.includes('일'));
    if (retiredIdx >= 0 && !idxs.includes(retiredIdx)) {
      // 입사일자 다음에 삽입
      const joinPos = idxs.findIndex(i => headers[i].includes('입사'));
      if (joinPos >= 0) idxs.splice(joinPos+1, 0, retiredIdx);
      else idxs.push(retiredIdx);
    }
  }

  const finalHeaders = idxs.map(i => headers[i]);
  // 특정 이름 제외
  const nameColIdx = idxs.findIndex(i => matchHeader(headers[i], '이름'));
  let filteredRows = rows;
  if (rules.excludeNames?.length && nameColIdx >= 0) {
    const nameRawIdx = idxs[nameColIdx];
    filteredRows = rows.filter(r => !rules.excludeNames.includes(String(r[nameRawIdx]||'').trim()));
  }
  const finalRows = filteredRows.map(r => idxs.map(i => String(r[i]??'')));

  // 성별/나이 추가
  if (rules.addGenderAge && residentIdx >= 0) {
    finalHeaders.push('성별', '나이');
    filteredRows.forEach((r, ri) => {
      const ga = calcGenderAge(r[residentIdx]);
      finalRows[ri].push(ga?.gender||'-', ga?.age||'-');
    });
  }

  return { headers: finalHeaders, rows: finalRows };
}
const _workerCache = {};

function parseGvizResponse(text) {
  return JSON.parse(text.replace(/^[^\(]*\((.*)\);?$/s, '$1')).table;
}
function extractCellValue(cell) {
  if (!cell) return '';
  return cell.f != null ? cell.f : (cell.v != null ? cell.v : '');
}

async function fetchWorkerSheetTable(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${WORKER_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return parseGvizResponse(text);
}

function WorkerPage() {
  const [allData, setAllData] = useState(_workerCache.__loaded ? { ..._workerCache } : null);
  const [loading, setLoading] = useState(!_workerCache.__loaded);
  const [loadError, setLoadError] = useState(null);
  const [selCompany, setSelCompany] = useState('PPPP');
  const [selStatus, setSelStatus] = useState('재직');
  const [search, setSearch] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      await Promise.all(WORKER_SHEETS.map(async s => {
        const key = `${s.company}_${s.status}`;
        try {
          const table = await fetchWorkerSheetTable(s.sheetName);
          // C열(index 2)부터 전체 열 가져오기 (주민번호, 퇴사일자 등 포함)
          const rawCols = table.cols.slice(2);
          const rawHeaders = rawCols.map(c => (c.label || '').trim());
          const colCount = rawCols.length;
          const rawRows = table.rows
            .map(r => r.c.slice(2, 2 + colCount).map(cell => String(extractCellValue(cell) ?? '')))
            .filter(row => row.some(v => v.trim() !== ''));
          const processed = applySheetRules(key, rawHeaders, rawRows);
          _workerCache[key] = processed;
        } catch (e) {
          _workerCache[key] = { headers: [], rows: [], error: e.message };
        }
      }));
      _workerCache.__loaded = true;
      setAllData({ ..._workerCache });
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!_workerCache.__loaded) loadAll();
    else { setAllData({ ..._workerCache }); setLoading(false); }
  }, [loadAll]);

  const key = `${selCompany}_${selStatus}`;
  const cur = (allData && allData[key]) || { headers:[], rows:[] };
  const filtered = search
    ? cur.rows.filter(row => row.some(v => String(v).toLowerCase().includes(search.toLowerCase())))
    : cur.rows;

  const statusLabel = (company, status) => {
    const key = `${company}_${status}`;
    const rule = SHEET_RULES[key];
    if (rule?.statusLabel) return rule.statusLabel;
    if (company === '영업본부') return status === '재직' ? '위촉' : '해촉';
    return status;
  };

  // 회사 탭 변경 시 재직으로 초기화
  const handleCompanyChange = (c) => { setSelCompany(c); setSelStatus('재직'); };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">근로자명부</div>
          <div className="page-desc">사업자별 재직·퇴직 근로자 현황 — Apps Script 연동</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={loadAll} disabled={loading}
          style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)' }}>
          {loading ? '로딩 중...' : '새로고침'}
        </button>
      </div>


      {/* 시트별 오류 표시 */}
      {allData && (() => {
        const errs = WORKER_SHEETS.map(s => {
          const d = allData[`${s.company}_${s.status}`];
          return d?.error ? `${s.sheetName}: ${d.error}` : null;
        }).filter(Boolean);
        return errs.length > 0 ? (
          <div style={{ background:'var(--color-error-light)', color:'var(--color-error)', padding:'10px 16px', borderRadius:'var(--radius-md)', marginBottom:12, fontSize:'var(--text-xs)', whiteSpace:'pre-line' }}>
            ⚠ 일부 시트 로딩 실패:{'\n'}{errs.join('\n')}
          </div>
        ) : null;
      })()}
      {/* 전체 오류 */}
      {loadError && (
        <div style={{ background:'var(--color-error-light)', color:'var(--color-error)', padding:'10px 16px', borderRadius:'var(--radius-md)', marginBottom:12, fontSize:'var(--text-sm)' }}>
          ⚠ 로딩 오류: {loadError}
        </div>
      )}
      {/* 진단 버튼 */}
      {!loading && allData && (
        <div style={{ marginBottom:8, fontSize:'var(--text-xs)', color:'var(--color-text-faint)', display:'flex', gap:8, alignItems:'center' }}>
          <span>총 재직: {WORKER_COMPANIES.reduce((s,c)=>s+(_workerCache[`${c}_재직`]?.rows.length||0),0)}명 | 퇴직: {WORKER_COMPANIES.reduce((s,c)=>s+(_workerCache[`${c}_퇴직`]?.rows.length||0),0)}명</span>
          <button className="btn btn-ghost btn-sm" style={{ fontSize:'var(--text-xs)', padding:'2px 8px' }} onClick={async()=>{
            try {
              const url = `https://docs.google.com/spreadsheets/d/${WORKER_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent('퍼플_재직')}`;
              const res = await fetch(url);
              const text = await res.text();
              alert(`HTTP ${res.status}\n\n앞 400자:\n${text.slice(0,400)}`);
            } catch(e) { alert('오류: '+e.message); }
          }}>진단</button>
        </div>
      )}

      {/* Company tabs */}
      <div className="tabs" style={{ marginBottom:12 }}>
        {WORKER_COMPANIES.map(c => {
          const reCount = _workerCache[`${c}_재직`]?.rows.length ?? 0;
          return (
            <button key={c} className={`tab-btn ${selCompany===c?'active':''}`} onClick={()=>handleCompanyChange(c)}>
              {c}{reCount > 0 && <span className="nav-count" style={{ marginLeft:4 }}>{reCount}</span>}
            </button>
          );
        })}
      </div>

      {/* PPPP만 재직/퇴직 탭 표시, 나머지는 재직만 */}
      <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'center' }}>
        {selCompany === 'PPPP' ? (
          ['재직','퇴직'].map(st => (
            <button key={st} className="btn btn-sm"
              style={{ background: selStatus===st?'var(--color-primary)':'var(--color-surface-offset)', color: selStatus===st?'#fff':'var(--color-text-muted)', padding:'4px 14px' }}
              onClick={()=>setSelStatus(st)}>
              {statusLabel(selCompany, st)}
              {(_workerCache[`${selCompany}_${st}`]?.rows.length ?? 0) > 0 &&
                <span style={{ marginLeft:4, fontSize:10 }}>({_workerCache[`${selCompany}_${st}`].rows.length})</span>}
            </button>
          ))
        ) : (
          <span style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)', padding:'4px 0' }}>
            {statusLabel(selCompany, '재직')} {_workerCache[`${selCompany}_재직`]?.rows.length ?? 0}명
          </span>
        )}
        <div className="search-wrap" style={{ marginLeft:'auto' }}>
          <Search size={14}/>
          <input className="search-input" placeholder="검색..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <span style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)', whiteSpace:'nowrap' }}>
          {loading ? '로딩 중...' : `${filtered.length}명`}
        </span>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width:40, textAlign:'center' }}>No.</th>
              {cur.headers.map((h,i) => <th key={i}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && !allData && (
              <tr><td colSpan={cur.headers.length+1} style={{textAlign:'center',color:'var(--color-text-faint)',padding:'32px 0'}}>구글 시트에서 데이터를 불러오는 중...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={cur.headers.length+1} style={{textAlign:'center',color:'var(--color-text-faint)',padding:'32px 0'}}>데이터가 없습니다.</td></tr>
            )}
            {filtered.map((row, ri) => (
              <tr key={ri}>
                <td style={{ textAlign:'center', color:'var(--color-text-faint)', fontSize:11 }}>{ri+1}</td>
                {row.map((cell, ci) => <td key={ci}>{String(cell ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── 대시보드용 입퇴사자 현황 카드 ─── */
function ChartWithLegend({ title, canvasRef, items, total, height=120 }) {
  const pct = n => total > 0 ? Math.round(n/total*100) : 0;
  return (
    <div style={{ flex:'1 1 200px' }}>
      <div style={{ fontSize:10, color:'var(--color-text-faint)', marginBottom:6 }}>{title}</div>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <div style={{ position:'relative', height, width:height }}><canvas ref={canvasRef}/></div>
        <div style={{ display:'flex', flexDirection:'column', gap:5, flex:1 }}>
          {items.map(({label,value,color}) => (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:8, height:8, borderRadius:2, background:color, flexShrink:0 }}/>
              <span style={{ fontSize:11, color:'var(--color-text-muted)', whiteSpace:'nowrap', marginRight:4 }}>{label}</span>
              <span style={{ fontSize:14, fontWeight:700, color }}>{value}</span>
              <span style={{ fontSize:10, color:'var(--color-text-faint)', marginLeft:2 }}>({pct(value)}%)</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BonsaDemographicsChart() {
  const ageRef    = useRef(null);
  const gndRef    = useRef(null);
  const tenureRef = useRef(null);
  const ageChart    = useRef(null);
  const gndChart    = useRef(null);
  const tenureChart = useRef(null);

  const d = _workerCache['PPPP_재직'];
  const gIdx = d?.headers?.indexOf('성별') ?? -1;
  const aIdx = d?.headers?.indexOf('나이') ?? -1;
  const jIdx = d?.headers?.findIndex(h => h.includes('입사')) ?? -1;
  if (!d || (gIdx < 0 && aIdx < 0)) return null;

  const total = d.rows.length;
  let male=0, female=0, a20=0, a30=0, a40=0, a50=0;
  let t0=0, t3=0, t6=0, t12=0, t24=0, t36=0;

  const today = new Date();
  d.rows.forEach(r => {
    if (gIdx>=0) { const g=String(r[gIdx]||''); if(g==='남')male++; else if(g==='여')female++; }
    if (aIdx>=0) { const age=parseInt(r[aIdx]||'0'); if(age>=50)a50++; else if(age>=40)a40++; else if(age>=30)a30++; else if(age>=20)a20++; }
    if (jIdx>=0) {
      const raw = String(r[jIdx]||'').trim().replace(/\./g,'-');
      const joinDate = new Date(raw);
      if (!isNaN(joinDate.getTime())) {
        const months = (today.getFullYear()-joinDate.getFullYear())*12 + (today.getMonth()-joinDate.getMonth());
        if (months < 3)       t0++;
        else if (months < 6)  t3++;
        else if (months < 12) t6++;
        else if (months < 24) t12++;
        else if (months < 36) t24++;
        else                  t36++;
      }
    }
  });

  useEffect(() => {
    const isDark = document.documentElement.getAttribute('data-theme')==='dark';
    const textColor = isDark ? '#888785' : '#6b6b6b';
    const bg = isDark ? '#1c1b19' : '#ffffff';

    const makeChart = (ref, chartRef, labels, data, colors) => {
      if (!ref.current) return;
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new Chart(ref.current, {
        type:'doughnut',
        data:{ labels, datasets:[{ data, backgroundColor:colors, borderWidth:2, borderColor:bg }] },
        options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } } }
      });
    };

    makeChart(gndRef, gndChart, ['남','여'], [male,female], ['#006494','#a12c7b']);
    makeChart(ageRef, ageChart, ['20대','30대','40대','50대↑'], [a20,a30,a40,a50], CHART_COLORS);
    makeChart(tenureRef, tenureChart,
      ['3개월 미만','3~6개월','6~12개월','12~24개월','24~36개월','36개월↑'],
      [t0,t3,t6,t12,t24,t36], CHART_COLORS);

    return () => {
      [gndChart, ageChart, tenureChart].forEach(c => { if (c.current) c.current.destroy(); });
    };
  }, [a20,a30,a40,a50,male,female,t0,t3,t6,t12,t24,t36]);

  return (
    <div style={{ marginTop:12, padding:'12px', background:'var(--color-surface-2)', borderRadius:'var(--radius-md)', borderTop:'1px solid var(--color-divider)' }}>
      <div style={{ fontSize:'var(--text-xs)', fontWeight:600, color:'var(--color-text-muted)', marginBottom:10 }}>
        PPPP 구성원 현황 (재직 {total}명)
      </div>
      <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
        {/* 성별 */}
        <ChartWithLegend title="성별" canvasRef={gndRef} height={120}
          items={[{label:'남',value:male,color:'#006494'},{label:'여',value:female,color:'#a12c7b'}]}
          total={total}/>
        {/* 연령대 */}
        <ChartWithLegend title="연령대" canvasRef={ageRef} height={120}
          items={[{label:'20대',value:a20,color:CHART_COLORS[0]},{label:'30대',value:a30,color:CHART_COLORS[1]},{label:'40대',value:a40,color:CHART_COLORS[2]},{label:'50대↑',value:a50,color:CHART_COLORS[3]}]}
          total={total}/>
        {/* 근속기간 */}
        <ChartWithLegend title="근속기간" canvasRef={tenureRef} height={120}
          items={[{label:'3개월 미만',value:t0,color:CHART_COLORS[0]},{label:'3~6개월',value:t3,color:CHART_COLORS[1]},{label:'6~12개월',value:t6,color:CHART_COLORS[2]},{label:'12~24개월',value:t12,color:CHART_COLORS[3]},{label:'24~36개월',value:t24,color:CHART_COLORS[4]},{label:'36개월↑',value:t36,color:CHART_COLORS[5]||'#888'}]}
          total={total}/>
      </div>
    </div>
  );
}

const COMPANY_GROUPS = [
  { label:'본사', key:'bonsa',  color:'var(--color-primary)', companies:['PPPP'] },
  { label:'영업', key:'sales',  color:'var(--color-blue)',    companies:['영업본부'] },
  { label:'F&B', key:'fnb',    color:'var(--color-warning)',  companies:['그랑디르','교도리','PZPZ'] },
];

function WorkerSummaryCard({ selMonths, deptFilter, onlyCharts=false }) {
  const [loaded, setLoaded] = useState(_workerCache.__loaded);
  const [loading, setLoading] = useState(!_workerCache.__loaded);

  useEffect(() => {
    if (_workerCache.__loaded) { setLoaded(true); setLoading(false); return; }
    setLoading(true);
    Promise.all(WORKER_SHEETS.map(async s => {
      const key = `${s.company}_${s.status}`;
      if (_workerCache[key]) return;
      try {
        const table = await fetchWorkerSheetTable(s.sheetName);
        const rawCols = table.cols.slice(2);
        const rawHeaders = rawCols.map(c => (c.label || '').trim());
        const rawRows = table.rows
          .map(r => r.c.slice(2, 2 + rawCols.length).map(cell => String(extractCellValue(cell) ?? '')))
          .filter(row => row.some(v => v.trim() !== ''));
        _workerCache[key] = applySheetRules(key, rawHeaders, rawRows);
      } catch { _workerCache[key] = { headers:[], rows:[] }; }
    })).then(() => {
      _workerCache.__loaded = true;
      setLoaded(true);
      setLoading(false);
    });
  }, []);

  // 월 필터 적용 카운트
  const selArr = selMonths ? [...selMonths].sort() : [];
  const isAllMonths = selArr.length === 0 || selArr.length >= ALL_MONTHS.length;

  const getCompanyCounts = (co) => {
    const activeData = _workerCache[`${co}_재직`];
    const leftData   = _workerCache[`${co}_퇴직`];
    if (isAllMonths) {
      return { active: activeData?.rows.length||0, left: leftData?.rows.length||0 };
    }
    // 선택된 월에 입사한 사람
    const joinCol = activeData?.headers?.findIndex(h => h.includes('입사')||h.includes('위촉')) ?? -1;
    const active  = joinCol>=0
      ? (activeData?.rows||[]).filter(r => selArr.some(m => String(r[joinCol]||'').startsWith(m))).length
      : 0;
    // 선택된 월에 퇴사/해촉한 사람
    const leftCol = leftData?.headers?.findIndex(h => h.includes('퇴사')||h.includes('해촉일')) ?? -1;
    const left    = leftCol>=0
      ? (leftData?.rows||[]).filter(r => selArr.some(m => String(r[leftCol]||'').startsWith(m))).length
      : 0;
    return { active, left };
  };

  // deptFilter → 표시할 그룹
  const deptToGroups = {
    '전체':  COMPANY_GROUPS,
    '본사':  COMPANY_GROUPS.filter(g => g.key === 'bonsa'),
    '영업':  COMPANY_GROUPS.filter(g => g.key === 'sales'),
    'F&B':  COMPANY_GROUPS.filter(g => g.key === 'fnb'),
  };
  const visibleGroups = deptToGroups[deptFilter] || COMPANY_GROUPS;
  const visibleCompanies = visibleGroups.flatMap(g => g.companies);

  const gTotal = visibleCompanies.reduce((acc, co) => {
    const c = getCompanyCounts(co);
    return { active: acc.active+c.active, left: acc.left+c.left };
  }, { active:0, left:0 });

  // 전월 대비 (1개월 선택 시)
  let prevDelta = null;
  if (!isAllMonths && selArr.length === 1) {
    const [y, m] = selArr[0].split('-').map(Number);
    const prevY = m === 1 ? y-1 : y;
    const prevM = m === 1 ? 12 : m-1;
    const prevYM = `${prevY}-${String(prevM).padStart(2,'0')}`;
    const prevActive = visibleCompanies.reduce((s, co) => {
      const d = _workerCache[`${co}_재직`];
      const col = d?.headers?.findIndex(h => h.includes('입사')||h.includes('위촉')) ?? -1;
      return s + (col>=0 ? (d?.rows||[]).filter(r => String(r[col]||'').startsWith(prevYM)).length : 0);
    }, 0);
    const prevLeft = visibleCompanies.reduce((s, co) => {
      const d = _workerCache[`${co}_퇴직`];
      const col = d?.headers?.findIndex(h => h.includes('퇴사')||h.includes('해촉일')) ?? -1;
      return s + (col>=0 ? (d?.rows||[]).filter(r => String(r[col]||'').startsWith(prevYM)).length : 0);
    }, 0);
    prevDelta = { prevYM, prevActive, prevLeft, dActive: gTotal.active-prevActive, dLeft: gTotal.left-prevLeft };
  }

  const monthLabel = !isAllMonths
    ? selArr.length === 1
      ? selArr[0].replace('-','년 ')+'월'
      : `${selArr.length}개월`
    : '전체';

  // 기간 선택 전(위): 구성원 현황 차트만 렌더
  if (onlyCharts) {
    if (loading) return (
      <div className="card" style={{ marginBottom:20 }}>
        <div className="card-title">구성원 현황</div>
        <div style={{ color:'var(--color-text-faint)', fontSize:'var(--text-sm)', padding:'8px 0' }}>데이터 로딩 중...</div>
      </div>
    );
    if (!loaded || deptFilter !== '본사') return null;
    return (
      <div className="card" style={{ marginBottom:20 }}>
        <div className="card-title" style={{ marginBottom:10 }}>구성원 현황</div>
        <BonsaDemographicsChart/>
      </div>
    );
  }

  // 기간 선택 후(아래): 입사/퇴사 수
  if (loading) return null;
  return (
    <div className="card" style={{ marginBottom:20 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div className="card-title" style={{ marginBottom:0 }}>입퇴사자 현황</div>
        <span style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)' }}>
          {monthLabel} · {isAllMonths?'재직':'입사'} {gTotal.active} · {isAllMonths?'퇴직':'퇴사'} {gTotal.left}
        </span>
      </div>

      {prevDelta && (
        <div style={{ display:'flex', gap:16, marginBottom:10, padding:'6px 12px', background:'var(--color-surface-2)', borderRadius:'var(--radius-md)', fontSize:'var(--text-xs)', flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ color:'var(--color-text-muted)', fontWeight:600 }}>전월 대비</span>
          {[
            { label:'입사', d: prevDelta.dActive, prev: prevDelta.prevActive, cur: gTotal.active },
            { label:'퇴사', d: prevDelta.dLeft,   prev: prevDelta.prevLeft,   cur: gTotal.left },
          ].map(({label, d, prev, cur}) => (
            <span key={label}>
              {label}{' '}
              <strong style={{ color: d>0?'var(--color-blue)':d<0?'var(--color-error)':'var(--color-text-muted)' }}>
                {d>0?'▲':d<0?'▼':'━'} {Math.abs(d)}
              </strong>
              <span style={{ color:'var(--color-text-faint)', marginLeft:4 }}>({prev}→{cur})</span>
            </span>
          ))}
        </div>
      )}

      {visibleGroups.map(group => (
        <div key={group.key} style={{ marginBottom: visibleGroups.length>1?10:0 }}>
          {visibleGroups.length>1 && (
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
              <div style={{ width:3, height:14, background:group.color, borderRadius:2 }}/>
              <span style={{ fontWeight:700, fontSize:'var(--text-xs)', color:group.color }}>{group.label}</span>
            </div>
          )}
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {group.companies.map(co => {
              const { active, left } = getCompanyCounts(co);
              const total = active+left;
              const pct   = total>0 ? Math.round((active/total)*100) : 0;
              return (
                <div key={co} style={{ flex:'1 1 120px', background:'var(--color-surface-2)', border:'1px solid var(--color-divider)', borderRadius:'var(--radius-md)', padding:'10px 14px' }}>
                  <div style={{ fontWeight:700, fontSize:'var(--text-sm)', marginBottom:6 }}>{co}</div>
                  <div style={{ display:'flex', gap:4, marginBottom:6 }}>
                    <span className="badge badge-success">{isAllMonths?'재직':'입사'} {active}</span>
                    <span className="badge badge-gray">{isAllMonths?'퇴직':'퇴사'} {left}</span>
                  </div>
                  {total>0 && (
                    <div style={{ background:'var(--color-divider)', borderRadius:3, height:3, overflow:'hidden' }}>
                      <div style={{ width:`${pct}%`, height:'100%', background:group.color, borderRadius:3 }}/>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MEETING LOG PAGE (면담일지)
═══════════════════════════════════════════ */
const MEETING_SHEET_ID = '1H7r8nPzsNp_suHwBoIlCnc21Wn4-wKWJpOHkUpYA99s';
const MEETING_GID = '923966650';
let _meetingCache = null;

function MeetingLogPage() {
  const [records, setRecords] = useState(() => JSON.parse(localStorage.getItem('meetingLog') || '[]'));
  const [colW, setColW] = useState(() => { try { return JSON.parse(localStorage.getItem('meetingLogColW')) || { date:100, dept:90, name:90, content:300, manager:90 }; } catch { return { date:100, dept:90, name:90, content:300, manager:90 }; } });
  const [ctxMenu, setCtxMenu] = useState(null);
  const [viewPopup, setViewPopup] = useState(null);
  const [sheetData, setSheetData] = useState(_meetingCache);
  const [sheetLoading, setSheetLoading] = useState(!_meetingCache);
  const [sheetError, setSheetError] = useState(null);
  const [sheetSearch, setSheetSearch] = useState('');
  const idRef = useRef(1);

  useEffect(() => {
    if (_meetingCache) { setSheetData(_meetingCache); setSheetLoading(false); return; }
    const url = `https://docs.google.com/spreadsheets/d/${MEETING_SHEET_ID}/gviz/tq?tqx=out:json&gid=${MEETING_GID}`;
    fetch(url).then(r => r.text()).then(text => {
      try {
        const table = parseGvizResponse(text);
        const headers = table.cols.map(c => (c.label||'').trim()).filter(Boolean);
        const rows = table.rows.map(r =>
          r.c.map(cell => String(extractCellValue(cell)??''))
        ).filter(r => r.some(v => v.trim() !== ''));
        _meetingCache = { headers, rows };
        setSheetData(_meetingCache);
      } catch(e) { setSheetError('데이터 파싱 오류: '+e.message); }
      setSheetLoading(false);
    }).catch(e => { setSheetError('로딩 오류: '+e.message); setSheetLoading(false); });
  }, []);
  useEffect(() => { idRef.current = records.length ? Math.max(...records.map(r=>r.id),0)+1 : 1; }, []);
  useEffect(() => {
    if (!ctxMenu) return;
    const h = () => setCtxMenu(null);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [ctxMenu]);

  const save = (next) => { setRecords(next); localStorage.setItem('meetingLog', JSON.stringify(next)); };

  const startColResize = (e, col) => {
    e.preventDefault();
    let lastX = e.clientX;
    const onMove = (ev) => {
      const delta = ev.clientX - lastX; lastX = ev.clientX;
      setColW(prev => ({ ...prev, [col]: Math.max(60, (prev[col]??60) + delta) }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setColW(prev => { localStorage.setItem('meetingLogColW', JSON.stringify(prev)); return prev; });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const addRow = () => {
    const d = new Date(); const dt = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    save([...records, { id:idRef.current++, date:dt, dept:'', name:'', content:'', manager:'', memo:'' }]);
  };
  const insertRow = (refId, pos) => {
    const ref = records.find(r=>r.id===refId);
    const d = new Date(); const dt = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const newRow = { id:idRef.current++, date:ref?.date||dt, dept:ref?.dept||'', name:'', content:'', manager:'', memo:'' };
    const idx = records.findIndex(r=>r.id===refId);
    const next = [...records]; next.splice(pos==='above'?idx:idx+1, 0, newRow);
    save(next); setCtxMenu(null);
  };
  const update = (id, field, value) => save(records.map(r => r.id!==id ? r : {...r,[field]:value}));
  const del = (id) => { if(confirm('삭제하시겠습니까?')) { save(records.filter(r=>r.id!==id)); setCtxMenu(null); } };

  const openContent = (e, id) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setViewPopup({ id, x:Math.min(rect.left, window.innerWidth-430), y:Math.min(rect.bottom+4, window.innerHeight-300) });
  };
  const vpRec = viewPopup ? records.find(r=>r.id===viewPopup.id) : null;

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">면담일지</div><div className="page-desc">임직원 면담 기록 — 구글 시트 연동</div></div>
        <div style={{ display:'flex', gap:6 }}>
          <button className="btn btn-ghost btn-sm" style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)' }}
            onClick={()=>{ _meetingCache=null; setSheetData(null); setSheetLoading(true); setSheetError(null);
              const url=`https://docs.google.com/spreadsheets/d/${MEETING_SHEET_ID}/gviz/tq?tqx=out:json&gid=${MEETING_GID}`;
              fetch(url).then(r=>r.text()).then(text=>{
                const table=parseGvizResponse(text);
                const headers=table.cols.map(c=>(c.label||'').trim()).filter(Boolean);
                const rows=table.rows.map(r=>r.c.map(cell=>String(extractCellValue(cell)??''))).filter(r=>r.some(v=>v.trim()!==''));
                _meetingCache={headers,rows}; setSheetData(_meetingCache); setSheetLoading(false);
              }).catch(e=>{setSheetError(e.message);setSheetLoading(false);});
            }}>새로고침</button>
          <button className="btn btn-primary" onClick={addRow}><Plus size={14}/> 메모 추가</button>
        </div>
      </div>

      {/* 구글 시트 면담일지 */}
      {sheetLoading && <div style={{ color:'var(--color-text-faint)', fontSize:'var(--text-sm)', marginBottom:16 }}>구글 시트 불러오는 중...</div>}
      {sheetError && <div style={{ color:'var(--color-error)', fontSize:'var(--text-sm)', marginBottom:16 }}>⚠ {sheetError}</div>}
      {sheetData && (
        <div style={{ marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <div style={{ fontWeight:700, fontSize:'var(--text-sm)' }}>면담 기록 ({sheetData.rows.length}건)</div>
            <div className="search-wrap">
              <Search size={13}/>
              <input className="search-input" placeholder="검색..." value={sheetSearch} onChange={e=>setSheetSearch(e.target.value)} style={{ width:160 }}/>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width:36, textAlign:'center' }}>No.</th>
                  {sheetData.headers.map((h,i) => <th key={i}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {sheetData.rows
                  .filter(r => !sheetSearch || r.some(v => v.toLowerCase().includes(sheetSearch.toLowerCase())))
                  .map((row, ri) => (
                    <tr key={ri}>
                      <td style={{ textAlign:'center', color:'var(--color-text-faint)', fontSize:11 }}>{ri+1}</td>
                      {sheetData.headers.map((_,ci) => <td key={ci}>{row[ci]||''}</td>)}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ fontWeight:700, fontSize:'var(--text-sm)', marginBottom:8 }}>메모 ({records.length}건)</div>
      <div className="table-wrap">
        <table className="data-table" style={{ tableLayout:'fixed', width:'100%' }}>
          <colgroup>
            <col style={{ width:22 }}/>
            <col style={{ width:colW.date }}/>
            <col style={{ width:colW.dept }}/>
            <col style={{ width:colW.name }}/>
            <col style={{ width:colW.content }}/>
            <col style={{ width:130 }}/>
            <col style={{ width:colW.manager }}/>
            <col style={{ width:50 }}/>
          </colgroup>
          <thead>
            <tr>
              <th style={{ padding:0 }}></th>
              <th style={{ position:'relative' }}>면담일<div style={{ position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'col-resize',userSelect:'none' }} onMouseDown={e=>startColResize(e,'date')}/></th>
              <th style={{ position:'relative' }}>소속<div style={{ position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'col-resize',userSelect:'none' }} onMouseDown={e=>startColResize(e,'dept')}/></th>
              <th style={{ position:'relative' }}>이름<div style={{ position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'col-resize',userSelect:'none' }} onMouseDown={e=>startColResize(e,'name')}/></th>
              <th style={{ position:'relative' }}>면담 내용<div style={{ position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'col-resize',userSelect:'none' }} onMouseDown={e=>startColResize(e,'content')}/></th>
              <th style={{ textAlign:'center' }}>상세 내용</th>
              <th style={{ position:'relative' }}>담당자<div style={{ position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'col-resize',userSelect:'none' }} onMouseDown={e=>startColResize(e,'manager')}/></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {records.length===0 && <tr><td colSpan={8} style={{textAlign:'center',color:'var(--color-text-faint)',padding:'32px 0'}}>면담 기록이 없습니다.</td></tr>}
            {records.map(r => (
              <tr key={r.id}>
                <td className="row-handle-cell">
                  <div className="row-handle-dot" onClick={e=>{ e.stopPropagation(); const rect=e.currentTarget.getBoundingClientRect(); setCtxMenu({x:rect.right+4,y:rect.top-4,id:r.id}); }}>⋮⋮</div>
                </td>
                <td><input className="inline-input" value={r.date} onChange={e=>update(r.id,'date',e.target.value)} placeholder="YYYY-MM-DD"/></td>
                <td><input className="inline-input" value={r.dept||''} onChange={e=>update(r.id,'dept',e.target.value)} placeholder="소속"/></td>
                <td><input className="inline-input" value={r.name} onChange={e=>update(r.id,'name',e.target.value)} placeholder="이름"/></td>
                <td><input className="inline-input" value={r.content} onChange={e=>update(r.id,'content',e.target.value)} placeholder="간략 내용"/></td>
                <td style={{ textAlign:'center' }}>
                  <button className="btn btn-sm" style={{ background:r.memo?'var(--color-blue-light)':'var(--color-surface-offset)', color:r.memo?'var(--color-blue)':'var(--color-text-faint)', padding:'3px 10px', fontSize:'var(--text-xs)' }} onClick={e=>openContent(e,r.id)}>
                    {r.memo?'내용보기':'내용입력'}
                  </button>
                </td>
                <td><input className="inline-input" value={r.manager||''} onChange={e=>update(r.id,'manager',e.target.value)} placeholder="담당자"/></td>
                <td><button className="btn btn-sm" style={{color:'var(--color-error)',opacity:0.6}} onClick={()=>del(r.id)}>삭제</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ctxMenu && (
        <div className="row-context-menu" style={{ left:ctxMenu.x, top:ctxMenu.y }} onClick={e=>e.stopPropagation()}>
          <button className="rcm-btn" onClick={()=>insertRow(ctxMenu.id,'above')}>↑ 위에 행 추가</button>
          <button className="rcm-btn" onClick={()=>insertRow(ctxMenu.id,'below')}>↓ 아래에 행 추가</button>
          <div className="rcm-divider"/>
          <button className="rcm-btn danger" onClick={()=>del(ctxMenu.id)}>✕ 행 삭제</button>
        </div>
      )}

      {viewPopup && vpRec && (
        <>
          <div style={{ position:'fixed', inset:0, zIndex:999 }} onClick={()=>setViewPopup(null)}/>
          <div style={{ position:'fixed', left:viewPopup.x, top:viewPopup.y, zIndex:1000, background:'var(--color-surface)', border:'1px solid var(--color-divider)', borderRadius:'var(--radius-lg)', boxShadow:'var(--color-shadow-md)', padding:16, width:420 }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontWeight:700, marginBottom:6, fontSize:'var(--text-sm)' }}>면담 상세 내용 — {vpRec.name||'(이름 없음)'}</div>
            <textarea
              value={vpRec.memo||''}
              onChange={e=>update(vpRec.id,'memo',e.target.value)}
              placeholder="면담 상세 내용을 입력하세요..."
              style={{ width:'100%', minHeight:160, border:'1px solid var(--color-border)', borderRadius:'var(--radius-sm)', padding:10, fontSize:'var(--text-sm)', lineHeight:1.65, background:'var(--color-surface)', color:'var(--color-text)', resize:'vertical', fontFamily:'inherit', outline:'none' }}
            />
            <div style={{ display:'flex', justifyContent:'flex-end', gap:6, marginTop:8 }}>
              {vpRec.memo && <button className="btn btn-sm" style={{ background:'var(--color-primary-light)',color:'var(--color-primary)' }} onClick={()=>navigator.clipboard.writeText(vpRec.memo)}>복사</button>}
              <button className="btn btn-sm btn-ghost" onClick={()=>setViewPopup(null)}>닫기</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   ATTENDANCE INITIAL DATA
═══════════════════════════════════════════ */
const INITIAL_ATTEND_MISS = [
  {id:1, yearMonth:'2025-09',name:'김채영',dates:'9/1 9/4 9/5 9/8 9/16 9/19 9/23',count:7,checked:false,warned:false},
  {id:2, yearMonth:'2025-09',name:'서수진',dates:'9/23',count:1,checked:false,warned:false},
  {id:3, yearMonth:'2025-09',name:'한현옥',dates:'9/3',count:1,checked:false,warned:false},
  {id:4, yearMonth:'2025-09',name:'정아윤',dates:'9/8 9/9 9/10 9/11 9/15 9/16 9/19',count:7,checked:false,warned:false},
  {id:5, yearMonth:'2025-09',name:'이한모',dates:'9/10',count:1,checked:false,warned:false},
  {id:6, yearMonth:'2025-09',name:'이송아',dates:'9/29',count:1,checked:false,warned:false},
  {id:7, yearMonth:'2025-09',name:'이정연',dates:'9/18 9/25',count:2,checked:false,warned:false},
  {id:8, yearMonth:'2025-09',name:'김은혜',dates:'9/2 9/24',count:2,checked:false,warned:false},
  {id:9, yearMonth:'2025-09',name:'이해나',dates:'9/5',count:1,checked:false,warned:false},
  {id:10,yearMonth:'2025-09',name:'김상우',dates:'9/1 9/5 9/9 9/15 9/19',count:5,checked:false,warned:false},
  {id:11,yearMonth:'2025-09',name:'성대창',dates:'9/2 9/5 9/9 9/12 9/29',count:5,checked:false,warned:false},
  {id:12,yearMonth:'2025-09',name:'송이',dates:'9/2 9/5 9/9 9/12 9/29',count:5,checked:false,warned:false},
  {id:13,yearMonth:'2025-09',name:'신지은',dates:'9/19 9/25(6시간?)',count:2,checked:false,warned:false},
  {id:14,yearMonth:'2025-09',name:'조민범',dates:'9/22(새벽1시??)',count:1,checked:false,warned:false},
  {id:15,yearMonth:'2025-09',name:'이수빈',dates:'9/30',count:1,checked:false,warned:false},
  {id:16,yearMonth:'2025-10',name:'김채영',dates:'10/02',count:1,checked:false,warned:false},
  {id:17,yearMonth:'2025-10',name:'서수진',dates:'10/31',count:1,checked:false,warned:false},
  {id:18,yearMonth:'2025-10',name:'오은찬',dates:'10/31',count:1,checked:false,warned:false},
  {id:19,yearMonth:'2025-10',name:'유성정',dates:'10/31',count:1,checked:false,warned:false},
  {id:20,yearMonth:'2025-10',name:'김하영',dates:'10/13',count:1,checked:false,warned:false},
  {id:21,yearMonth:'2025-10',name:'이용우',dates:'10/23, 10/28',count:2,checked:false,warned:false},
  {id:22,yearMonth:'2025-10',name:'곽지원',dates:'10/13, 10/16',count:2,checked:false,warned:false},
  {id:23,yearMonth:'2025-10',name:'김은혜',dates:'10/29',count:1,checked:false,warned:false},
  {id:24,yearMonth:'2025-10',name:'송이',dates:'10/10, 10/13, 10/22, 10/29',count:4,checked:false,warned:false},
  {id:25,yearMonth:'2025-10',name:'성대창',dates:'10/22',count:1,checked:false,warned:false},
  {id:26,yearMonth:'2025-10',name:'이수빈',dates:'10/16, 10/20, 10/21',count:3,checked:false,warned:false},
  {id:27,yearMonth:'2025-11',name:'박태린',dates:'11/6',count:1,checked:false,warned:false},
  {id:28,yearMonth:'2025-11',name:'조성준',dates:'11/13, 11/14, 11/18, 11/27',count:4,checked:false,warned:false},
  {id:29,yearMonth:'2025-11',name:'김채영',dates:'11/14 연차?, 11/24',count:2,checked:false,warned:false},
  {id:30,yearMonth:'2025-11',name:'서수진',dates:'11/24',count:1,checked:false,warned:false},
  {id:31,yearMonth:'2025-11',name:'유성정',dates:'11/14, 11/28',count:2,checked:false,warned:false},
  {id:32,yearMonth:'2025-11',name:'김지윤',dates:'11/11',count:1,checked:false,warned:false},
  {id:33,yearMonth:'2025-11',name:'정아윤',dates:'11/26',count:1,checked:false,warned:false},
  {id:34,yearMonth:'2025-11',name:'곽지원',dates:'11/10',count:1,checked:false,warned:false},
  {id:35,yearMonth:'2025-11',name:'성대창',dates:'11/3, 11/5, 11/10, 11/11',count:4,checked:false,warned:false},
  {id:36,yearMonth:'2025-11',name:'송이',dates:'11/3, 11/5, 11/10, 11/11',count:4,checked:false,warned:false},
  {id:37,yearMonth:'2025-11',name:'성은정',dates:'11/7',count:1,checked:false,warned:false},
  {id:38,yearMonth:'2025-11',name:'이수빈',dates:'11/12',count:1,checked:false,warned:false},
  {id:39,yearMonth:'2025-12',name:'유성정',dates:'12/17',count:1,checked:false,warned:false},
  {id:40,yearMonth:'2025-12',name:'조성준',dates:'12/26',count:1,checked:false,warned:false},
  {id:41,yearMonth:'2025-12',name:'이선영',dates:'12/31',count:1,checked:false,warned:false},
  {id:42,yearMonth:'2025-12',name:'이용우',dates:'12/11, 12/23',count:2,checked:false,warned:false},
  {id:43,yearMonth:'2025-12',name:'박상헌',dates:'12/23',count:1,checked:false,warned:false},
  {id:44,yearMonth:'2025-12',name:'성대창',dates:'12/3',count:1,checked:false,warned:false},
  {id:45,yearMonth:'2025-12',name:'이해나',dates:'12/4, 12/17',count:2,checked:false,warned:false},
  {id:46,yearMonth:'2026-01',name:'연한국',dates:'1/27',count:1,checked:false,warned:false},
  {id:47,yearMonth:'2026-01',name:'정유빈',dates:'1/29, 1/30',count:2,checked:false,warned:false},
  {id:48,yearMonth:'2026-01',name:'성대창',dates:'1/6 1/16 1/21 1/22 1/23 1/26 1/30',count:7,checked:false,warned:false},
  {id:49,yearMonth:'2026-01',name:'송이',dates:'1/6 1/16 1/26 1/30',count:4,checked:false,warned:false},
  {id:50,yearMonth:'2026-02',name:'김지수',dates:'2/27',count:1,checked:false,warned:false},
  {id:51,yearMonth:'2026-02',name:'김하영',dates:'2/20',count:1,checked:false,warned:false},
  {id:52,yearMonth:'2026-02',name:'김은혜',dates:'2/25',count:1,checked:false,warned:false},
  {id:53,yearMonth:'2026-02',name:'곽지원',dates:'2/27',count:1,checked:false,warned:false},
  {id:54,yearMonth:'2026-02',name:'이수빈',dates:'2/27',count:1,checked:false,warned:false},
  {id:55,yearMonth:'2026-02',name:'성대창',dates:'2/3, 2/19, 2/23, 2/27',count:4,checked:false,warned:false},
  {id:56,yearMonth:'2026-02',name:'송이',dates:'2/19, 2/23, 2/27',count:3,checked:false,warned:false},
  {id:57,yearMonth:'2026-03',name:'성대창',dates:'3/3, 3/4, 3/5, 3/6, 3/9, 3/10, 3/11, 3/12, 3/13, 3/16, 3/19, 3/20, 3/23, 3/24, 3/25, 3/26, 3/27, 3/30, 3/31',count:19,checked:false,warned:false},
  {id:58,yearMonth:'2026-03',name:'송이',dates:'3/3, 3/4, 3/5, 3/6, 3/9, 3/10, 3/11, 3/12, 3/13, 3/16, 3/17, 3/19, 3/20, 3/23, 3/24, 3/25, 3/26, 3/27, 3/30, 3/31',count:20,checked:false,warned:false},
  {id:59,yearMonth:'2026-03',name:'박민우',dates:'3/31 5분 지각',count:1,checked:false,warned:false},
  {id:60,yearMonth:'2026-05',name:'고재령',dates:'5/4',count:1,checked:false,warned:false},
  {id:61,yearMonth:'2026-05',name:'김소연',dates:'5/21, 5/28',count:1,checked:false,warned:false},
  {id:62,yearMonth:'2026-05',name:'서수진',dates:'5/29',count:1,checked:false,warned:false},
  {id:63,yearMonth:'2026-05',name:'김하영',dates:'5/8',count:1,checked:false,warned:false},
  {id:64,yearMonth:'2026-05',name:'이형표',dates:'5/13, 5/28',count:2,checked:false,warned:false},
  {id:65,yearMonth:'2026-05',name:'곽지원',dates:'5/20',count:1,checked:false,warned:false},
  {id:66,yearMonth:'2026-05',name:'성대창',dates:'5/4, 6, 7, 8, 11, 12, 13, 14, 15, 18, 19, 20, 21, 22, 25, 26, 27, 28, 29',count:19,checked:false,warned:false},
  {id:67,yearMonth:'2026-05',name:'송이',dates:'5/4, 6, 7, 8, 11, 12, 13, 14, 15, 18, 19, 20, 21, 22, 25, 26, 27, 28, 29',count:19,checked:false,warned:false},
];

/* ═══════════════════════════════════════════
   ATTENDANCE HELPERS
═══════════════════════════════════════════ */
function countDates(str) {
  if (!str?.trim()) return 0;
  // 공백·쉼표로 분리 후 날짜처럼 보이는 토큰만 카운트
  // 인정: 9/1, 10/23(메모), 6, 7 (월 생략된 일자)
  // 제외: 연차?, 지각, 5분 등 텍스트 주석
  return str.trim().split(/[\s,]+/).filter(t =>
    /^\d+\/\d+/.test(t) || /^\d{1,2}$/.test(t)
  ).length;
}
function getQuarterKey(ym) {
  const [year, month] = ym.split('-').map(Number);
  return `${year}-Q${Math.ceil(month / 3)}`;
}
function quarterLabel(qk) {
  const [year, q] = qk.split('-Q');
  return `${year}년 ${q}/4분기`;
}
const WARN_TEMPLATE = (name, ym, dates, count) => {
  const [y, m] = ym.split('-');
  return `안녕하세요 ${name}님,\n\n${y}년 ${parseInt(m)}월 근태 누락이 총 ${count}회 발생하였습니다.\n누락 일자: ${dates}\n\n향후 유사한 상황이 반복될 경우 인사 조치가 있을 수 있으므로,\n근태 관리에 각별히 주의해 주시기 바랍니다.\n\n감사합니다.\n인사팀 드림`;
};

/* ═══════════════════════════════════════════
   ATTENDANCE MISS PAGE (근태 누락)
═══════════════════════════════════════════ */
function AttendanceMissPage() {
  const [records, setRecords] = useState(() => {
    const s = localStorage.getItem('attendMiss');
    const data = (s && s !== '[]') ? JSON.parse(s) : INITIAL_ATTEND_MISS;
    return data.map(r => ({ ...r, count: countDates(r.dates) }));
  });
  const [colW, setColW] = useState(() => { try { return JSON.parse(localStorage.getItem('attendMissColW')) || { dept:90, name:100, dates:350 }; } catch { return { dept:90, name:100, dates:350 }; } });
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [warnModal, setWarnModal] = useState(null);
  const [warnText, setWarnText] = useState('');
  const [ctxMenu, setCtxMenu] = useState(null);
  const [selQKeys, setSelQKeys] = useState([]);
  const [viewModal, setViewModal] = useState(null);
  const idRef = useRef(1);
  useEffect(() => { idRef.current = records.length ? Math.max(...records.map(r => r.id), 0) + 1 : 1; }, []);
  useEffect(() => {
    if (!ctxMenu) return;
    const h = () => setCtxMenu(null);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [ctxMenu]);

  const save = (next) => { setRecords(next); localStorage.setItem('attendMiss', JSON.stringify(next)); };

  const startColResize = (e, col) => {
    e.preventDefault();
    let lastX = e.clientX;
    const onMove = (ev) => {
      const delta = ev.clientX - lastX;
      lastX = ev.clientX;
      setColW(prev => ({ ...prev, [col]: Math.max(60, (prev[col] ?? 60) + delta) }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setColW(prev => { localStorage.setItem('attendMissColW', JSON.stringify(prev)); return prev; });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const addRow = () => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    save([...records, { id: idRef.current++, yearMonth: ym, dept: '', name: '', dates: '', count: 0, checked: false, warned: false, memo: '' }]);
  };
  const insertRow = (refId, position) => {
    const ref = records.find(r => r.id === refId);
    const ym = ref?.yearMonth || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    const newRow = { id: idRef.current++, yearMonth: ym, dept: '', name: '', dates: '', count: 0, checked: false, warned: false, memo: '' };
    const idx = records.findIndex(r => r.id === refId);
    const next = [...records];
    next.splice(position === 'above' ? idx : idx + 1, 0, newRow);
    save(next);
    setCtxMenu(null);
  };
  const update = (id, field, value) => save(records.map(r => {
    if (r.id !== id) return r;
    const u = { ...r, [field]: value };
    if (field === 'dates') u.count = countDates(value);
    return u;
  }));
  const del = (id) => { if (confirm('삭제하시겠습니까?')) { save(records.filter(r => r.id !== id)); setCtxMenu(null); } };
  const toggleChecked = (id) => save(records.map(r => r.id === id ? { ...r, checked: !r.checked } : r));
  const openWarn = (r) => { setWarnText(WARN_TEMPLATE(r.name, r.yearMonth, r.dates, r.count)); setWarnModal(r); };
  const confirmWarn = () => {
    const existing = JSON.parse(localStorage.getItem('attendWarn') || '[]');
    const maxId = existing.length ? Math.max(...existing.map(r => r.id), 0) : 0;
    localStorage.setItem('attendWarn', JSON.stringify([...existing, { id: maxId + 1, yearMonth: warnModal.yearMonth, name: warnModal.name, dates: warnModal.dates, count: warnModal.count, action: '경고 완료', content: '근태 미체크' }]));
    save(records.map(r => r.id === warnModal.id ? { ...r, warned: true } : r));
    setWarnModal(null);
  };

  const filtered = records.filter(r => r.yearMonth?.startsWith(yearFilter));
  const groupMap = {};
  filtered.forEach(r => { if (!groupMap[r.yearMonth]) groupMap[r.yearMonth] = []; groupMap[r.yearMonth].push(r); });
  const sortedMonths = Object.keys(groupMap).sort().reverse();

  // Quarterly summary (all data)
  const qSum = {};
  records.forEach(r => {
    if (!r.name || !r.yearMonth) return;
    const qk = getQuarterKey(r.yearMonth);
    if (!qSum[r.name]) qSum[r.name] = {};
    qSum[r.name][qk] = (qSum[r.name][qk] || 0) + (r.count || 0);
  });
  const allQKeys = [...new Set(records.filter(r => r.yearMonth).map(r => getQuarterKey(r.yearMonth)))].sort();
  const allNames = [...new Set(Object.keys(qSum))].sort();

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">근태 누락</div><div className="page-desc">월별 근태 누락 입력 및 분기별 종합 — 점검완료 후 경고 안내 발송</div></div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select className="filter-select" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
            {['2024','2025','2026','2027'].map(y => <option key={y}>{y}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)' }}
            onClick={() => { if(confirm('기존 데이터를 모두 지우고 초기 데이터로 교체하시겠습니까?')) { localStorage.setItem('attendMiss', JSON.stringify(INITIAL_ATTEND_MISS)); setRecords(INITIAL_ATTEND_MISS); idRef.current = INITIAL_ATTEND_MISS.length + 1; } }}>
            초기화
          </button>
          <button className="btn btn-primary" onClick={addRow}><Plus size={14}/> 행 추가</button>
        </div>
      </div>
      {/* 근태 기준 */}
      <div style={{ background:'var(--color-warning-light)', border:'1px solid rgba(150,66,25,0.3)', borderRadius:'var(--radius-md)', padding:'10px 16px', marginBottom:16, fontSize:'var(--text-sm)' }}>
        <div style={{ fontWeight:700, marginBottom:4, color:'var(--color-warning)' }}>📋 근태 기준</div>
        <div style={{ color:'var(--color-text)', lineHeight:1.8 }}>
          출·퇴근 미타각, 지각 및 근태 미달 발생 시 아래 패널티가 적용됩니다.<br/>
          1) 월 <strong>3회</strong> 미타각·지각·근태미달 발생 시 → <strong>경위서 작성</strong><br/>
          2) 분기 내 경위서 <strong>2회</strong> 발생 시 → <strong>인사위원회 회부</strong> (견책, 감봉, 정직 등)<br/>
          3) 경위서·인사위원회 회부 기록은 인사 고과에 반영됩니다.
        </div>
      </div>

      <div className="table-wrap" style={{ marginBottom:24 }}>
        <table className="data-table" style={{ tableLayout:'fixed', width:'100%' }}>
          <colgroup>
            <col style={{ width:22 }}/>
            <col style={{ width:95 }}/>
            <col style={{ width:colW.dept }}/>
            <col style={{ width:colW.name }}/>
            <col style={{ width:colW.dates }}/>
            <col style={{ width:70 }}/>
            <col style={{ width:90 }}/>
            <col style={{ width:90 }}/>
            <col/>
            <col style={{ width:50 }}/>
          </colgroup>
          <thead>
            <tr>
              <th style={{ padding:0 }}></th>
              <th>연/월</th>
              <th style={{ position:'relative' }}>
                소속
                <div style={{ position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'col-resize',userSelect:'none' }} onMouseDown={e=>startColResize(e,'dept')}/>
              </th>
              <th style={{ position:'relative' }}>
                이름
                <div style={{ position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'col-resize',userSelect:'none' }} onMouseDown={e=>startColResize(e,'name')}/>
              </th>
              <th style={{ position:'relative' }}>
                누락 일자 (공백 구분)
                <div style={{ position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'col-resize',userSelect:'none' }} onMouseDown={e=>startColResize(e,'dates')}/>
              </th>
              <th style={{ textAlign:'center' }}>횟수</th>
              <th style={{ textAlign:'center' }}>점검</th>
              <th style={{ textAlign:'center' }}>경고안내</th>
              <th>비고</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedMonths.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign:'center', color:'var(--color-text-faint)', padding:'32px 0' }}>행 추가 버튼을 눌러 데이터를 입력하세요.</td></tr>
            )}
            {sortedMonths.map(ym =>
              groupMap[ym].map((r, idx) => {
                const over = r.count >= 3;
                return (
                  <tr key={r.id}>
                    <td className="row-handle-cell">
                      <div className="row-handle-dot" onClick={e => { e.stopPropagation(); const rect=e.currentTarget.getBoundingClientRect(); setCtxMenu({x:rect.right+4,y:rect.top-4,id:r.id}); }}>⋮⋮</div>
                    </td>
                    <td style={{ fontWeight:600, color:'var(--color-text-muted)', background: idx===0?'var(--color-surface-offset)':'transparent', borderRight:'2px solid var(--color-divider)', whiteSpace:'nowrap' }}>
                      {idx === 0 ? ym.replace('-','년 ')+'월' : ''}
                    </td>
                    <td><input className="inline-input" value={r.dept||''} onChange={e=>update(r.id,'dept',e.target.value)} placeholder="소속"/></td>
                    <td><input className="inline-input" value={r.name} onChange={e=>update(r.id,'name',e.target.value)} placeholder="이름"/></td>
                    <td><input className="inline-input" value={r.dates} onChange={e=>update(r.id,'dates',e.target.value)} placeholder="9/1 9/5 9/10"/></td>
                    <td style={{ textAlign:'center', background: over?'var(--color-error-light)':undefined, borderRadius: over?3:0 }}>
                      <div style={{ fontWeight:700, color: over?'var(--color-error)':r.count>=2?'var(--color-warning)':'var(--color-text)' }}>{r.count||'-'}</div>
                      {over && <div style={{ fontSize:9, color:'var(--color-error)', fontWeight:700, whiteSpace:'nowrap', lineHeight:1.4 }}>경위서 필요</div>}
                    </td>
                    <td style={{ textAlign:'center' }}>
                      {r.checked
                        ? <span className="badge badge-success" style={{ cursor:'pointer' }} onClick={()=>toggleChecked(r.id)} title="클릭하여 해제">완료</span>
                        : <button className="btn btn-sm" style={{ background:'var(--color-warning-light)',color:'var(--color-warning)',padding:'3px 8px' }} onClick={()=>toggleChecked(r.id)}>점검중</button>
                      }
                    </td>
                    <td style={{ textAlign:'center' }}>
                      {r.checked && (r.warned
                        ? <span className="badge badge-gray" style={{ cursor:'pointer' }} onClick={e=>{ e.stopPropagation(); const rect=e.currentTarget.getBoundingClientRect(); setViewModal({record:r, x:Math.min(rect.left,window.innerWidth-430), y:Math.min(rect.bottom+4,window.innerHeight-290)}); }} title="클릭하여 발송 메시지 확인">발송됨 👁</span>
                        : <button className="btn btn-sm btn-danger" style={{ padding:'3px 8px' }} onClick={()=>openWarn(r)}>경고 안내</button>
                      )}
                    </td>
                    <td><input className="inline-input" value={r.memo||''} onChange={e=>update(r.id,'memo',e.target.value)} placeholder="비고"/></td>
                    <td><button className="btn btn-sm" style={{ color:'var(--color-error)',opacity:0.6 }} onClick={()=>del(r.id)}>삭제</button></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {viewModal && (
        <>
          <div style={{ position:'fixed', inset:0, zIndex:999 }} onClick={()=>setViewModal(null)}/>
          <div style={{ position:'fixed', left:viewModal.x, top:viewModal.y, zIndex:1000, background:'var(--color-surface)', border:'1px solid var(--color-divider)', borderRadius:'var(--radius-lg)', boxShadow:'var(--color-shadow-md)', padding:16, width:420 }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontWeight:700, marginBottom:6, fontSize:'var(--text-sm)' }}>발송된 경고 메시지 — {viewModal.record.name}</div>
            <textarea
              readOnly
              value={WARN_TEMPLATE(viewModal.record.name, viewModal.record.yearMonth, viewModal.record.dates, viewModal.record.count)}
              style={{ width:'100%', minHeight:170, border:'1px solid var(--color-border)', borderRadius:'var(--radius-sm)', padding:10, fontSize:'var(--text-sm)', lineHeight:1.65, background:'var(--color-surface-offset)', color:'var(--color-text)', resize:'none', fontFamily:'inherit', outline:'none' }}
            />
            <div style={{ display:'flex', gap:6, justifyContent:'flex-end', marginTop:8 }}>
              <button className="btn btn-sm" style={{ background:'var(--color-primary-light)', color:'var(--color-primary)' }}
                onClick={()=>navigator.clipboard.writeText(WARN_TEMPLATE(viewModal.record.name, viewModal.record.yearMonth, viewModal.record.dates, viewModal.record.count))}>복사</button>
              <button className="btn btn-sm btn-ghost" onClick={()=>setViewModal(null)}>닫기</button>
            </div>
          </div>
        </>
      )}

      {ctxMenu && (
        <div className="row-context-menu" style={{ left:ctxMenu.x, top:ctxMenu.y }} onClick={e=>e.stopPropagation()}>
          <button className="rcm-btn" onClick={()=>insertRow(ctxMenu.id,'above')}>↑ 위에 행 추가</button>
          <button className="rcm-btn" onClick={()=>insertRow(ctxMenu.id,'below')}>↓ 아래에 행 추가</button>
          <div className="rcm-divider"/>
          <button className="rcm-btn danger" onClick={()=>del(ctxMenu.id)}>✕ 행 삭제</button>
        </div>
      )}

      {allNames.length > 0 && (() => {
        const dispQKeys = selQKeys.length ? allQKeys.filter(qk => selQKeys.includes(qk)) : allQKeys;
        const sortedNames = [...allNames].sort((a,b) => {
          const tA = dispQKeys.reduce((s,qk)=>s+(qSum[a]?.[qk]||0),0);
          const tB = dispQKeys.reduce((s,qk)=>s+(qSum[b]?.[qk]||0),0);
          return tB - tA;
        });
        const toggleQ = (qk) => setSelQKeys(prev => prev.includes(qk) ? prev.filter(k=>k!==qk) : [...prev,qk]);
        const chipStyle = (qk) => ({
          padding:'3px 10px', borderRadius:'var(--radius-full)', fontSize:'var(--text-xs)', fontWeight:600,
          cursor:'pointer', border:'1px solid '+(selQKeys.includes(qk)?'var(--color-primary)':'var(--color-border)'),
          background: selQKeys.includes(qk)?'var(--color-primary)':'transparent',
          color: selQKeys.includes(qk)?'#fff':'var(--color-text-muted)',
        });
        return (
          <div className="card">
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, flexWrap:'wrap' }}>
              <div className="card-title" style={{ marginBottom:0 }}>분기별 누락 종합</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                {allQKeys.map(qk => (
                  <button key={qk} style={chipStyle(qk)} onClick={()=>toggleQ(qk)}>{quarterLabel(qk)}</button>
                ))}
                {selQKeys.length > 0 && (
                  <button onClick={()=>setSelQKeys([])} style={{ padding:'3px 10px', borderRadius:'var(--radius-full)', fontSize:'var(--text-xs)', fontWeight:600, cursor:'pointer', border:'1px solid var(--color-border)', background:'transparent', color:'var(--color-text-muted)' }}>전체</button>
                )}
              </div>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>이름</th>
                    {dispQKeys.map(qk => <th key={qk} style={{ textAlign:'center', whiteSpace:'nowrap' }}>{quarterLabel(qk)}</th>)}
                    <th style={{ textAlign:'center' }}>합계</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedNames.map(name => {
                    const dispTotal = dispQKeys.reduce((s,qk)=>s+(qSum[name]?.[qk]||0),0);
                    if (selQKeys.length > 0 && dispTotal === 0) return null;
                    return (
                      <tr key={name}>
                        <td style={{ fontWeight:600 }}>{name}</td>
                        {dispQKeys.map(qk => {
                          const cnt = qSum[name]?.[qk] || 0;
                          return <td key={qk} style={{ textAlign:'center', fontWeight:cnt>0?700:400, color:cnt>=3?'var(--color-error)':cnt>=2?'var(--color-warning)':cnt>0?'var(--color-text)':'var(--color-text-faint)' }}>{cnt||'-'}</td>;
                        })}
                        <td style={{ textAlign:'center', fontWeight:700, color:dispTotal>=5?'var(--color-error)':dispTotal>=3?'var(--color-warning)':'var(--color-text)' }}>{dispTotal||'-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {warnModal && (
        <div className="modal-overlay open" onClick={() => setWarnModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:560 }}>
            <div className="modal-header">
              <div className="modal-title">근태 경고 안내 — {warnModal.name}</div>
              <button className="modal-close" onClick={() => setWarnModal(null)}>✕</button>
            </div>
            <div style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)', marginBottom:6 }}>이메일 초안을 수정 후 복사하여 발송하세요.</div>
            <textarea
              value={warnText}
              onChange={e => setWarnText(e.target.value)}
              style={{ width:'100%', minHeight:220, border:'1px solid var(--color-border)', borderRadius:'var(--radius-sm)', padding:12, fontSize:'var(--text-sm)', lineHeight:1.7, background:'var(--color-surface)', color:'var(--color-text)', resize:'vertical', fontFamily:'inherit', outline:'none', marginBottom:12 }}
            />
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setWarnModal(null)}>취소</button>
              <button className="btn" style={{ background:'var(--color-primary-light)', color:'var(--color-primary)' }} onClick={() => navigator.clipboard.writeText(warnText)}>복사</button>
              <button className="btn btn-primary" onClick={confirmWarn}>경고 기록 완료</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   ATTENDANCE WARNING PAGE (근태 경고 건)
═══════════════════════════════════════════ */
function AttendanceWarningPage() {
  const [records, setRecords] = useState(() => JSON.parse(localStorage.getItem('attendWarn') || '[]'));
  const idRef = useRef(1);
  useEffect(() => { idRef.current = records.length ? Math.max(...records.map(r => r.id), 0) + 1 : 1; }, []);

  const save = (next) => { setRecords(next); localStorage.setItem('attendWarn', JSON.stringify(next)); };
  const addRow = () => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    save([...records, { id:idRef.current++, yearMonth:ym, name:'', dates:'', count:0, action:'경고 완료', content:'' }]);
  };
  const update = (id, field, value) => save(records.map(r => r.id!==id ? r : {...r,[field]:value}));
  const del = (id) => { if(confirm('삭제하시겠습니까?')) save(records.filter(r => r.id!==id)); };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">근태 경고 건</div><div className="page-desc">근태 누락으로 인한 경고 발송 기록</div></div>
        <button className="btn btn-primary" onClick={addRow}><Plus size={14}/> 행 추가</button>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th style={{width:95}}>연/월</th><th>이름</th><th>누락 일자</th><th style={{textAlign:'center',width:55}}>횟수</th><th>경고 조치</th><th>내용</th><th style={{width:50}}></th></tr>
          </thead>
          <tbody>
            {records.length===0 && <tr><td colSpan={7} style={{textAlign:'center',color:'var(--color-text-faint)',padding:'32px 0'}}>경고 기록이 없습니다. 근태 누락 탭에서 경고 기록 완료 시 자동 추가됩니다.</td></tr>}
            {records.map(r => (
              <tr key={r.id}>
                <td><input className="inline-input" value={r.yearMonth} onChange={e=>update(r.id,'yearMonth',e.target.value)} style={{width:85}}/></td>
                <td><input className="inline-input" value={r.name} onChange={e=>update(r.id,'name',e.target.value)} placeholder="이름"/></td>
                <td><input className="inline-input" value={r.dates} onChange={e=>update(r.id,'dates',e.target.value)} placeholder="날짜"/></td>
                <td style={{textAlign:'center'}}><input className="inline-input" type="number" value={r.count} onChange={e=>update(r.id,'count',parseInt(e.target.value)||0)} style={{width:45,textAlign:'center'}}/></td>
                <td><select className="inline-select" value={r.action} onChange={e=>update(r.id,'action',e.target.value)}>
                  <option>경고 완료</option><option>주의 조치</option><option>진행 중</option>
                </select></td>
                <td><input className="inline-input" value={r.content} onChange={e=>update(r.id,'content',e.target.value)} placeholder="내용"/></td>
                <td><button className="btn btn-sm" style={{color:'var(--color-error)',opacity:0.6}} onClick={()=>del(r.id)}>삭제</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   OTHER WARNING PAGE (기타 경고 건)
═══════════════════════════════════════════ */
function OtherWarningPage() {
  const [records, setRecords] = useState(() => JSON.parse(localStorage.getItem('otherWarn') || '[]'));
  const [colW, setColW] = useState(() => { try { return JSON.parse(localStorage.getItem('otherWarnColW')) || { ym:95, dept:90, name:110, content:260, warningBy:100 }; } catch { return { ym:95, dept:90, name:110, content:260, warningBy:100 }; } });
  const [msgPopup, setMsgPopup] = useState(null); // { x, y, id }
  const [ctxMenu, setCtxMenu] = useState(null);
  const idRef = useRef(1);
  useEffect(() => { idRef.current = records.length ? Math.max(...records.map(r=>r.id),0)+1 : 1; }, []);
  useEffect(() => {
    if (!ctxMenu) return;
    const h = () => setCtxMenu(null);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [ctxMenu]);

  const save = (next) => { setRecords(next); localStorage.setItem('otherWarn', JSON.stringify(next)); };

  const startColResize = (e, col) => {
    e.preventDefault();
    let lastX = e.clientX;
    const onMove = (ev) => {
      const delta = ev.clientX - lastX;
      lastX = ev.clientX;
      setColW(prev => ({ ...prev, [col]: Math.max(60, (prev[col] ?? 60) + delta) }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setColW(prev => { localStorage.setItem('otherWarnColW', JSON.stringify(prev)); return prev; });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const addRow = () => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    save([...records, { id:idRef.current++, yearMonth:ym, dept:'', name:'', content:'', message:'', warningBy:'' }]);
  };
  const insertRow = (refId, pos) => {
    const ref = records.find(r=>r.id===refId);
    const ym = ref?.yearMonth || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    const newRow = { id:idRef.current++, yearMonth:ym, dept:'', name:'', content:'', message:'', warningBy:'' };
    const idx = records.findIndex(r=>r.id===refId);
    const next = [...records];
    next.splice(pos==='above'?idx:idx+1, 0, newRow);
    save(next);
    setCtxMenu(null);
  };
  const update = (id, field, value) => save(records.map(r => r.id!==id ? r : {...r,[field]:value}));
  const del = (id) => { if(confirm('삭제하시겠습니까?')) { save(records.filter(r=>r.id!==id)); setCtxMenu(null); } };

  const openMsg = (e, id) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMsgPopup({ id, x: Math.min(rect.left, window.innerWidth-430), y: Math.min(rect.bottom+4, window.innerHeight-300) });
  };
  const popupRec = msgPopup ? records.find(r=>r.id===msgPopup.id) : null;

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">기타 경고 건</div><div className="page-desc">근태 외 기타 경고 발송 기록</div></div>
        <button className="btn btn-primary" onClick={addRow}><Plus size={14}/> 행 추가</button>
      </div>
      <div className="table-wrap">
        <table className="data-table" style={{ tableLayout:'fixed', width:'100%' }}>
          <colgroup>
            <col style={{ width:22 }}/>
            <col style={{ width:colW.ym }}/>
            <col style={{ width:colW.dept }}/>
            <col style={{ width:colW.name }}/>
            <col style={{ width:colW.content }}/>
            <col style={{ width:130 }}/>
            <col style={{ width:colW.warningBy }}/>
            <col style={{ width:50 }}/>
          </colgroup>
          <thead>
            <tr>
              <th style={{ padding:0 }}></th>
              <th style={{ position:'relative' }}>연/월<div style={{ position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'col-resize',userSelect:'none' }} onMouseDown={e=>startColResize(e,'ym')}/></th>
              <th style={{ position:'relative' }}>소속<div style={{ position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'col-resize',userSelect:'none' }} onMouseDown={e=>startColResize(e,'dept')}/></th>
              <th style={{ position:'relative' }}>이름<div style={{ position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'col-resize',userSelect:'none' }} onMouseDown={e=>startColResize(e,'name')}/></th>
              <th style={{ position:'relative' }}>내용<div style={{ position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'col-resize',userSelect:'none' }} onMouseDown={e=>startColResize(e,'content')}/></th>
              <th style={{ textAlign:'center' }}>전달된 메시지</th>
              <th style={{ position:'relative' }}>경고자<div style={{ position:'absolute',right:0,top:0,bottom:0,width:5,cursor:'col-resize',userSelect:'none' }} onMouseDown={e=>startColResize(e,'warningBy')}/></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {records.length===0 && <tr><td colSpan={8} style={{textAlign:'center',color:'var(--color-text-faint)',padding:'32px 0'}}>기타 경고 기록이 없습니다.</td></tr>}
            {records.map(r => (
              <tr key={r.id}>
                <td className="row-handle-cell">
                  <div className="row-handle-dot" onClick={e=>{ e.stopPropagation(); const rect=e.currentTarget.getBoundingClientRect(); setCtxMenu({x:rect.right+4,y:rect.top-4,id:r.id}); }}>⋮⋮</div>
                </td>
                <td><input className="inline-input" value={r.yearMonth} onChange={e=>update(r.id,'yearMonth',e.target.value)} style={{width:'100%'}}/></td>
                <td><input className="inline-input" value={r.dept||''} onChange={e=>update(r.id,'dept',e.target.value)} placeholder="소속"/></td>
                <td><input className="inline-input" value={r.name} onChange={e=>update(r.id,'name',e.target.value)} placeholder="이름"/></td>
                <td><input className="inline-input" value={r.content} onChange={e=>update(r.id,'content',e.target.value)} placeholder="경고 내용"/></td>
                <td style={{ textAlign:'center' }}>
                  <button className="btn btn-sm" style={{ background:r.message?'var(--color-blue-light)':'var(--color-surface-offset)', color:r.message?'var(--color-blue)':'var(--color-text-faint)', padding:'3px 10px', fontSize:'var(--text-xs)' }} onClick={e=>openMsg(e,r.id)}>
                    {r.message ? '내용보기' : '내용입력'}
                  </button>
                </td>
                <td><input className="inline-input" value={r.warningBy||''} onChange={e=>update(r.id,'warningBy',e.target.value)} placeholder="경고자"/></td>
                <td><button className="btn btn-sm" style={{color:'var(--color-error)',opacity:0.6}} onClick={()=>del(r.id)}>삭제</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ctxMenu && (
        <div className="row-context-menu" style={{ left:ctxMenu.x, top:ctxMenu.y }} onClick={e=>e.stopPropagation()}>
          <button className="rcm-btn" onClick={()=>insertRow(ctxMenu.id,'above')}>↑ 위에 행 추가</button>
          <button className="rcm-btn" onClick={()=>insertRow(ctxMenu.id,'below')}>↓ 아래에 행 추가</button>
          <div className="rcm-divider"/>
          <button className="rcm-btn danger" onClick={()=>del(ctxMenu.id)}>✕ 행 삭제</button>
        </div>
      )}

      {msgPopup && popupRec && (
        <>
          <div style={{ position:'fixed', inset:0, zIndex:999 }} onClick={()=>setMsgPopup(null)}/>
          <div style={{ position:'fixed', left:msgPopup.x, top:msgPopup.y, zIndex:1000, background:'var(--color-surface)', border:'1px solid var(--color-divider)', borderRadius:'var(--radius-lg)', boxShadow:'var(--color-shadow-md)', padding:16, width:420 }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontWeight:700, marginBottom:6, fontSize:'var(--text-sm)' }}>전달된 메시지 — {popupRec.name || '(이름 없음)'}</div>
            <textarea
              value={popupRec.message||''}
              onChange={e=>update(popupRec.id,'message',e.target.value)}
              placeholder="전달된 메시지 내용을 입력하세요..."
              style={{ width:'100%', minHeight:160, border:'1px solid var(--color-border)', borderRadius:'var(--radius-sm)', padding:10, fontSize:'var(--text-sm)', lineHeight:1.65, background:'var(--color-surface)', color:'var(--color-text)', resize:'vertical', fontFamily:'inherit', outline:'none' }}
            />
            <div style={{ display:'flex', justifyContent:'flex-end', gap:6, marginTop:8 }}>
              {popupRec.message && <button className="btn btn-sm" style={{ background:'var(--color-primary-light)',color:'var(--color-primary)' }} onClick={()=>navigator.clipboard.writeText(popupRec.message)}>복사</button>}
              <button className="btn btn-sm btn-ghost" onClick={()=>setMsgPopup(null)}>닫기</button>
            </div>
          </div>
        </>
      )}
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
  const [addingNew, setAddingNew]     = useState(false);
  const blankForm = { company:'본사', division:'', team:'', position:'', experienceLevel:'', status:'진행중', duties:'', requirements:'', preferred:'' };
  const [newForm, setNewForm]         = useState(blankForm);

  // 보고서 관리 탭 상태
  const [periods, setPeriods]       = useState(() => { try { return JSON.parse(localStorage.getItem('jdPeriods'))||{}; } catch { return {}; } });
  const [localPlan, setLocalPlan]   = useState(() => { const p={}; data.forEach(r=>{ p[r.id]={saramin:'',jobkorea:'',albamon:'',wanted:'',remember:'',note:'',...(r.costPlan||{})}; }); return p; });
  const [showCostReport, setShowCostReport] = useState(false);
  const [planDirty, setPlanDirty]   = useState(false);

  useEffect(() => {
    setLocalPlan(prev => {
      const p={...prev};
      data.forEach(r=>{ if(!p[r.id]) p[r.id]={saramin:'',jobkorea:'',albamon:'',wanted:'',remember:'',note:'',...(r.costPlan||{})}; });
      return p;
    });
  }, [data]);

  const parseAmt = t => { if(!t||!t.trim()||t.trim()==='-') return 0; const n=Number(t.replace(/[^0-9]/g,'')); return isNaN(n)?0:n; };
  const activeJDs = data.filter(r => r.status==='진행중');
  const planTotals = {};
  PLAT_KEYS.forEach(k=>{ planTotals[k]=activeJDs.reduce((s,r)=>s+parseAmt((localPlan[r.id]||{})[k]),0); });
  const planFixedTotal = PLAT_KEYS.filter(k=>!PLAT_VARIABLE.includes(k)).reduce((s,k)=>s+(planTotals[k]||0),0);

  const updateLocalPlan = (id, field, value) => {
    let v = value;
    if (field !== 'note' && value && !value.includes('%')) {
      const n = Number(value.replace(/[^0-9]/g, ''));
      if (!isNaN(n) && String(n).length > 0 && value.replace(/[^0-9]/g,'').length > 0) v = n.toLocaleString('ko-KR');
    }
    setLocalPlan(prev=>({...prev,[id]:{...(prev[id]||{}),[field]:v}}));
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
                <span style={{fontSize:'var(--text-sm)',color:'var(--color-text-muted)',minWidth:44,flexShrink:0}}>{PLAT_LABELS[k]}</span>
                <input className="search-input" style={{width:88}} placeholder="예: 3일"
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
                총 예상: <strong style={{color:'var(--color-primary)'}}>{fmtAmount(planFixedTotal)} + α</strong>
              </span>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <colgroup>
                <col style={{width:170}}/>
                {PLAT_KEYS.map(k=><col key={k} style={{width:105}}/>)}
                <col style={{width:140}}/>
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
                  ? <tr><td colSpan={PLAT_KEYS.length+2} style={{textAlign:'center',color:'var(--color-text-faint)',padding:'24px 0'}}>진행중인 포지션이 없습니다</td></tr>
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
                  <td colSpan={PLAT_KEYS.length} style={{textAlign:'right'}}>{fmtAmount(planFixedTotal)} + α</td>
                  <td/>
                </tr>
              </tfoot>}
            </table>
          </div>
        </div>
      </>}

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
  const [appName, setAppName] = useState(() => { try { return localStorage.getItem('appName') || '채용관리'; } catch { return '채용관리'; } });
  const [logoImg, setLogoImg]  = useState(() => { try { return localStorage.getItem('logoImg')  || ''; } catch { return ''; } });
  const [editingAppName, setEditingAppName] = useState(false);
  const logoInputRef = useRef(null);
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { const d = ev.target.result; setLogoImg(d); localStorage.setItem('logoImg', d); };
    reader.readAsDataURL(file);
  };
  const saveAppName = (v) => { const n=v.trim()||'채용관리'; setAppName(n); localStorage.setItem('appName',n); setEditingAppName(false); };
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

  const pageTitles = { dashboard:'대시보드', worker:'근로자명부', meeting:'면담일지', interview:'면접 일정', onboard:'교육 및 입사자', proposal:'포지션 제안 O/B', cost:'채용 비용', jd:'채용 J/D 관리', guide:'채용 안내 내용 양식', 'attend-miss':'근태 누락', 'other-warn':'기타 경고 건', settings:'설정' };

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
          {/* 로고 — 클릭하면 이미지 교체 */}
          <input ref={logoInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleLogoUpload}/>
          <div title="클릭해서 로고 이미지 교체" onClick={()=>logoInputRef.current?.click()}
            style={{width:28,height:28,borderRadius:7,background:'var(--color-primary)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,cursor:'pointer',overflow:'hidden'}}>
            {logoImg
              ? <img src={logoImg} alt="logo" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              : <span style={{color:'#fff',fontWeight:800,fontSize:11,letterSpacing:'-0.5px',fontFamily:'sans-serif',userSelect:'none'}}>HR</span>
            }
          </div>
          <div style={{minWidth:0}}>
            {/* 앱 이름 — 클릭하면 인라인 편집 */}
            {editingAppName
              ? <input autoFocus className="inline-input" defaultValue={appName}
                  style={{fontSize:'var(--text-base)',fontWeight:700,color:'var(--color-text)',padding:'1px 4px',width:'100%'}}
                  onBlur={e=>saveAppName(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter') saveAppName(e.target.value); if(e.key==='Escape') setEditingAppName(false); }}/>
              : <div className="sidebar-logo-text" title="클릭해서 이름 수정" onClick={()=>setEditingAppName(true)} style={{cursor:'pointer'}}>{appName}</div>
            }
            <div className="sidebar-logo-sub">인사팀 포털</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">메인</div>
          <button className={`nav-item ${page==='dashboard'?'active':''}`} onClick={()=>nav('dashboard')}><LayoutDashboard size={16}/> 대시보드</button>
          <div className="nav-divider"/>
          <div className="nav-section-label">임직원 관리</div>
          <button className={`nav-item ${page==='worker'?'active':''}`} onClick={()=>nav('worker')}><Users size={16}/> 근로자명부</button>
          <button className={`nav-item ${page==='meeting'?'active':''}`} onClick={()=>nav('meeting')}><BookText size={16}/> 면담일지</button>
          <div className="nav-divider"/>
          <div className="nav-section-label">채용 관리</div>
          <button className={`nav-item ${page==='interview'?'active':''}`} onClick={()=>nav('interview')}><CalendarCheck size={16}/> 면접 일정<span className="nav-count">{interviews.length}</span></button>
          <button className={`nav-item ${page==='onboard'?'active':''}`} onClick={()=>nav('onboard')}><UserCheck size={16}/> 교육 및 입사자<span className="nav-count">{onboards.length}</span></button>
          <button className={`nav-item ${page==='proposal'?'active':''}`} onClick={()=>nav('proposal')}><Send size={16}/> 포지션 제안 현황<span className="nav-count">{proposals.length}</span></button>
          <button className={`nav-item ${page==='cost'?'active':''}`} onClick={()=>nav('cost')}><Receipt size={16}/> 채용 비용<span className="nav-count">{costs.length}</span></button>
          <button className={`nav-item ${page==='jd'?'active':''}`} onClick={()=>nav('jd')}><FileText size={16}/> 채용 J/D 관리<span className="nav-count">{jds.filter(r=>r.status==='진행중').length}</span></button>
          <button className={`nav-item ${page==='guide'?'active':''}`} onClick={()=>nav('guide')}><MessageSquare size={16}/> 채용 안내 내용 양식</button>
          <div className="nav-divider"/>
          <div className="nav-section-label">근태 관리</div>
          <button className={`nav-item ${page==='attend-miss'?'active':''}`} onClick={()=>nav('attend-miss')}><ClipboardList size={16}/> 근태 누락</button>

          <button className={`nav-item ${page==='other-warn'?'active':''}`} onClick={()=>nav('other-warn')}><Clock size={16}/> 기타 경고 건</button>
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
          {page==='worker' && <WorkerPage/>}
          {page==='meeting' && <MeetingLogPage/>}
          {page==='guide' && <GuidePage/>}
          {page==='attend-miss' && <AttendanceMissPage/>}

          {page==='other-warn' && <OtherWarningPage/>}
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
