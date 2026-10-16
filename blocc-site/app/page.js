import SignupForm from '@/components/SignupForm';

export default function Home() {
  return (
    <main className="wrap">
      <section className="hero">
        <p className="eyebrow">올데이 3way백 · 오픈 알림</p>
        <h1>출근길에도, 미팅에도, 카페에서도. 가방 하나로.</h1>
        <p>
          숄더, 크로스, 백팩으로 바꿔 멜 수 있는 블랙 가방이에요. 15인치 노트북이 들어가요.
          펀딩이 열리는 날 문자로 가장 먼저 알려드릴게요.
        </p>
        <ul className="facts">
          <li><b>메는 방식</b>숄더 · 크로스 · 백팩</li>
          <li><b>색상</b>블랙</li>
          <li><b>노트북</b>15인치까지</li>
          <li><b>크기</b>40 × 30 × 10 cm</li>
        </ul>
        <p className="note" style={{ margin: 0 }}>가격과 오픈일은 아직 정해지지 않았어요. 정해지면 신청하신 분께 먼저 알려드려요.</p>
      </section>
      <SignupForm />
      <p className="foot">신청은 무료예요. 구매 의무는 없어요.</p>
    </main>
  );
}
