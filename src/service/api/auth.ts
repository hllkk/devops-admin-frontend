import { request } from "../request";

/** Get user info */
export function fetchGetUserInfo() {
  return request<Api.Auth.UserInfo>({ url: "/auth/getUserInfo" });
}

/** Login and get user info in one request */
export function fetchLoginWithInfo(userName: string, password: string, captchaToken?: string) {
  return request<Api.Auth.LoginWithInfoResponse>({
    url: "/auth/loginWithInfo",
    method: "post",
    data: {
      userName,
      password,
      captchaToken
    }
  });
}

/**
 * Refresh token - refresh token is sent via HttpOnly cookie
 */
export function fetchRefreshToken() {
  return request<Api.Auth.LoginToken>({
    url: "/auth/refreshToken",
    method: "post",
    data: {}
  });
}

/**
 * return custom backend error
 *
 * @param code error code
 * @param msg error message
 */
export function fetchCustomBackendError(code: string, msg: string) {
  return request({ url: "/auth/error", params: { code, msg } });
}

/** Logout - invalidate tokens on server side */
export function fetchLogout() {
  return request({
    url: "/auth/logout",
    method: "post"
  });
}

/** Fetch WeChat Work login QR code info (returns OAuth URL + sceneId) */
export function fetchWecomQrCode() {
  return request<Api.Auth.WecomQrCodeInfo>({
    url: "/auth/wecomLogin",
    method: "get"
  });
}

/** Poll QR code login status */
export function fetchQrCodeStatus(sceneId: string) {
  return request<Api.Auth.QrCodeStatus>({
    url: "/auth/qrCodeStatus",
    method: "get",
    params: { sceneId }
  });
}
