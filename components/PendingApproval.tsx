export default function PendingApproval() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm">
        <div className="inline-flex items-center rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs font-semibold text-white/80">
          Account status: Pending approval
        </div>

        <h1 className="mt-4 text-2xl font-semibold">Thanks — we received your request</h1>

        <p className="mt-3 text-white/70 leading-relaxed">
          Your account is currently pending review. Once approved, you’ll get full access to browse
          deals and submit offers.
        </p>

        <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="text-sm font-semibold">What happens next</div>
          <ul className="mt-2 space-y-2 text-sm text-white/70">
            <li>• We verify your buyer profile</li>
            <li>• We approve access (role switches to “buyer”)</li>
            <li>• You’ll be able to view properties immediately</li>
          </ul>
        </div>

        <p className="mt-5 text-xs text-white/50">
          Tip: If you’re testing, you can approve yourself by changing your role to <b>buyer</b> in
          the <b>profiles</b> table.
        </p>
      </div>
    </div>
  );
}