export function InviteLocked() {
  return (
    <button className="locked-card" type="button" disabled aria-describedby="invite-note">
      <span aria-hidden="true">⌁</span>
      <span><strong>초대하기</strong><small id="invite-note">추후 다른 사람과 함께 공부할 수 있어요.</small></span>
      <em>LOCKED</em>
    </button>
  );
}
