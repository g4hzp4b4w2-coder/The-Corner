import { useState } from "react";
import { supabase } from "./lib/supabaseClient";

const COPY = {
  title: { tr: "Giriş yap", en: "Sign in" },
  subtitle: {
    tr: "Antrenman günlüğün ve AI koçun için hesabına giriş yap.",
    en: "Sign in to access your training journal and AI coach.",
  },
  email: { tr: "E-posta", en: "Email" },
  password: { tr: "Şifre", en: "Password" },
  signIn: { tr: "Giriş yap", en: "Sign in" },
  signUp: { tr: "Hesap oluştur", en: "Create account" },
  toggleToSignUp: { tr: "Hesabın yok mu? Kayıt ol", en: "No account? Sign up" },
  toggleToSignIn: { tr: "Zaten hesabın var mı? Giriş yap", en: "Already have an account? Sign in" },
  checkEmail: {
    tr: "Kayıt oldun! E-postana gelen linke tıklayıp giriş yap.",
    en: "Signed up! Check your email and confirm to sign in.",
  },
  fillBoth: { tr: "İki alanı da doldur", en: "Fill in both fields" },
  genericError: { tr: "Bir şeyler ters gitti", en: "Something went wrong" },
  forgotLink: { tr: "Şifreni mi unuttun?", en: "Forgot your password?" },
  forgotTitle: { tr: "Şifreni sıfırla", en: "Reset your password" },
  forgotSubtitle: {
    tr: "E-posta adresini gir, sana şifreni sıfırlaman için bir link gönderelim.",
    en: "Enter your email and we'll send you a link to reset your password.",
  },
  sendResetLink: { tr: "Sıfırlama linki gönder", en: "Send reset link" },
  backToSignIn: { tr: "Giriş ekranına dön", en: "Back to sign in" },
  fillEmail: { tr: "E-posta adresini gir", en: "Enter your email" },
  resetSent: {
    tr: "E-postana bir sıfırlama linki gönderdik. Linke tıklayıp yeni şifreni belirle.",
    en: "We sent a reset link to your email. Click it to set a new password.",
  },
  newPasswordTitle: { tr: "Yeni şifre belirle", en: "Set a new password" },
  newPasswordSubtitle: {
    tr: "Hesabın için yeni bir şifre gir.",
    en: "Enter a new password for your account.",
  },
  newPassword: { tr: "Yeni şifre", en: "New password" },
  confirmPassword: { tr: "Yeni şifre (tekrar)", en: "New password (again)" },
  saveNewPassword: { tr: "Şifreyi kaydet", en: "Save password" },
  passwordsDontMatch: { tr: "Şifreler eşleşmiyor", en: "Passwords don't match" },
  passwordTooShort: { tr: "Şifre en az 6 karakter olmalı", en: "Password must be at least 6 characters" },
};

function c(key, lang) {
  return COPY[key][lang] || COPY[key].tr;
}

export default function AuthScreen({ lang }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (mode === "forgot") {
      if (!email.trim()) {
        setError(c("fillEmail", lang));
        return;
      }
      setLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setInfo(c("resetSent", lang));
      } catch (err) {
        setError(err.message || c("genericError", lang));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError(c("fillBoth", lang));
      return;
    }
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo(c("checkEmail", lang));
      }
    } catch (err) {
      setError(err.message || c("genericError", lang));
    } finally {
      setLoading(false);
    }
  };

  if (mode === "forgot") {
    return (
      <div className="px-5 py-10 flex-1 flex flex-col justify-center">
        <p className="text-neutral-100 text-lg font-medium mb-1" style={{ fontFamily: "'Oswald', sans-serif" }}>
          {c("forgotTitle", lang)}
        </p>
        <p className="text-neutral-500 text-xs mb-5">{c("forgotSubtitle", lang)}</p>

        <form onSubmit={submit}>
          <label className="text-neutral-500 text-xs block mb-1">{c("email", lang)}</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2 mb-3"
          />

          {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
          {info && <p className="text-emerald-400 text-xs mb-2">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-neutral-950 font-medium text-sm rounded-lg py-2.5 transition-colors"
          >
            {loading ? "…" : c("sendResetLink", lang)}
          </button>
        </form>

        <button
          onClick={() => {
            setMode("signin");
            setError("");
            setInfo("");
          }}
          className="text-neutral-500 text-xs mt-4 hover:text-neutral-300 transition-colors"
        >
          {c("backToSignIn", lang)}
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 py-10 flex-1 flex flex-col justify-center">
      <p className="text-neutral-100 text-lg font-medium mb-1" style={{ fontFamily: "'Oswald', sans-serif" }}>
        {c("title", lang)}
      </p>
      <p className="text-neutral-500 text-xs mb-5">{c("subtitle", lang)}</p>

      <form onSubmit={submit}>
        <label className="text-neutral-500 text-xs block mb-1">{c("email", lang)}</label>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2 mb-3"
        />
        <label className="text-neutral-500 text-xs block mb-1">{c("password", lang)}</label>
        <input
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2 mb-3"
        />

        {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
        {info && <p className="text-emerald-400 text-xs mb-2">{info}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-neutral-950 font-medium text-sm rounded-lg py-2.5 transition-colors"
        >
          {loading ? "…" : mode === "signin" ? c("signIn", lang) : c("signUp", lang)}
        </button>
      </form>

      {mode === "signin" && (
        <button
          onClick={() => {
            setMode("forgot");
            setError("");
            setInfo("");
          }}
          className="text-neutral-500 text-xs mt-4 hover:text-neutral-300 transition-colors text-left"
        >
          {c("forgotLink", lang)}
        </button>
      )}

      <button
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError("");
          setInfo("");
        }}
        className="text-neutral-500 text-xs mt-2 hover:text-neutral-300 transition-colors"
      >
        {mode === "signin" ? c("toggleToSignUp", lang) : c("toggleToSignIn", lang)}
      </button>
    </div>
  );
}

export function ResetPasswordForm({ lang, onDone }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError(c("passwordTooShort", lang));
      return;
    }
    if (password !== confirmPassword) {
      setError(c("passwordsDontMatch", lang));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      onDone();
    } catch (err) {
      setError(err.message || c("genericError", lang));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-5 py-10 flex-1 flex flex-col justify-center">
      <p className="text-neutral-100 text-lg font-medium mb-1" style={{ fontFamily: "'Oswald', sans-serif" }}>
        {c("newPasswordTitle", lang)}
      </p>
      <p className="text-neutral-500 text-xs mb-5">{c("newPasswordSubtitle", lang)}</p>

      <form onSubmit={submit}>
        <label className="text-neutral-500 text-xs block mb-1">{c("newPassword", lang)}</label>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2 mb-3"
        />
        <label className="text-neutral-500 text-xs block mb-1">{c("confirmPassword", lang)}</label>
        <input
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2 mb-3"
        />

        {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-neutral-950 font-medium text-sm rounded-lg py-2.5 transition-colors"
        >
          {saving ? "…" : c("saveNewPassword", lang)}
        </button>
      </form>
    </div>
  );
}
