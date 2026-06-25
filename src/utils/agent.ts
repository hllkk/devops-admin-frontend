export function isPC() {
  const agents = ['Android', 'iPhone', 'webOS', 'BlackBerry', 'SymbianOS', 'Windows Phone', 'iPad', 'iPod'];

  const isMobile = agents.some(agent => window.navigator.userAgent.includes(agent));

  return !isMobile;
}

/** 是否在企业微信 WebView（客户端内嵌浏览器）中打开，UA 含 wxwork */
export function isWecomWebview(): boolean {
  if (typeof window === 'undefined' || !window.navigator) return false;
  return /wxwork/i.test(window.navigator.userAgent);
}
