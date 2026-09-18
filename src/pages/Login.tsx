export function Login() {
  const start = (
    provider: 'google' | 'kakao',
  ) => {
    location.assign(
      `/api/v1/auth/oauth/${provider}`,
    );
  };

  return (
    <section className="page narrow-page">
      <p className="eyebrow">
        MEMBER ACCESS
      </p>

      <h1 className="page-title">
        내 학습공간 시작하기
      </h1>

      <p className="page-copy">
        개인룸과 파일은 로그인 회원에게만
        저장됩니다. 비밀번호 없이 간편로그인만
        사용합니다.
      </p>

      <div className="login-stack">
        <button
          className="social-button"
          onClick={() => start('google')}
        >
          <span>G</span>
          Google로 계속하기
        </button>

        <button
          className="social-button"
          onClick={() => start('kakao')}
        >
          <span>K</span>
          카카오로 계속하기
        </button>
      </div>

      <p className="fine-print">
        광장의 Basic Test는 로그인 없이 이용할 수
        있으며 비회원 기록은 마지막 활동 3일 후
        삭제됩니다.
      </p>
    </section>
  );
}