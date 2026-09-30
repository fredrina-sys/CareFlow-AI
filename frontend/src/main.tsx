import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/Auth";
import { I18nProvider } from "./i18n";
import { ToastProvider } from "./components/ui";
import "./index.css";

class AppErrorBoundary extends React.Component<React.PropsWithChildren, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error("CareFlow page render failed", error, info.componentStack); }
  render() {
    if (this.state.error) return (
      <main className="mx-auto mt-16 max-w-xl rounded-xl border border-red-200 bg-white p-6 text-slate-900 shadow">
        <h1 className="text-lg font-bold">CareFlow could not load this page</h1>
        <p className="mt-2 text-sm text-slate-600">Reload the page. If the problem continues, share this error with the project developer.</p>
        {(import.meta as any).env?.DEV && <pre className="mt-3 overflow-auto rounded bg-red-50 p-3 text-xs text-red-800">{this.state.error.message}</pre>}
        <button className="btn mt-4" onClick={() => window.location.reload()}>Reload page</button>
      </main>
    );
    return this.props.children;
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><AppErrorBoundary><BrowserRouter><I18nProvider><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></I18nProvider></BrowserRouter></AppErrorBoundary></React.StrictMode>);
