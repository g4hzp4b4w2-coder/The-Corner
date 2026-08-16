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

      <button
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError("");
          setInfo("");
        }}
        className="text-neutral-500 text-xs mt-4 hover:text-neutral-300 transition-colors"
      >
        {mode === "signin" ? c("toggleToSignUp", lang) : c("toggleToSignIn", lang)}
      </button>
    </div>
  );
}
