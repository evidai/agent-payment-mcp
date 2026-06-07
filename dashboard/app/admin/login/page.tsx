"use client";

/**
 * Admin sign-in is now just normal owner sign-in (magic link / OAuth at /app).
 * An owner becomes an admin when their verified email is in ADMIN_EMAILS — the
 * httpOnly session cookie then authorizes the operator console. No separate
 * admin password, no localStorage token, no Railway backend.
 */
export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-sm p-8">
        <div className="flex items-center gap-2.5 mb-8">
          <img src="/logo.png" alt="LemonCake" className="w-8 h-8 rounded-lg object-cover" />
          <div>
            <div className="text-sm font-bold text-gray-900">LemonCake</div>
            <div className="text-[10px] text-gray-400">Admin Console</div>
          </div>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-1">管理者サインイン</h1>
        <p className="text-sm text-gray-500 mb-6">
          管理者は通常のサインインで入ります。<b>許可された管理者メール</b>でサインインすると、
          このコンソールにアクセスできます。
        </p>

        <a
          href="/app"
          className="block w-full text-center py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          /app でサインイン →
        </a>

        <p className="mt-4 text-[11px] text-gray-400 leading-relaxed">
          サインイン後に <code className="font-mono">/admin</code> を開いてください。
          メールが <code className="font-mono">ADMIN_EMAILS</code> に登録されていない場合はアクセスできません。
        </p>
      </div>
    </div>
  );
}
