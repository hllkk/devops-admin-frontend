declare namespace Api {
  /**
   * namespace Auth
   *
   * backend api module: "auth"
   */
  namespace Auth {
    interface LoginToken {
      /** 仅用于主动刷新调度；token 本身走 HttpOnly cookie，不下发响应体 */
      expiresAt: number;
    }

    interface WecomQrCodeInfo {
      sceneId: string;
      oauthUrl: string;
      countdown: number;
    }

    interface QrCodeStatus {
      sceneId: string;
      status: 'waiting' | 'scanned' | 'confirmed' | 'expired' | 'fail';
      /** 确认后返回，token 走 HttpOnly cookie */
      expiresAt?: number;
    }

    /** Combined login + user info response */
    interface LoginWithInfoResponse {
      /** token 走 HttpOnly cookie 不下发；expiresAt 用于前端主动刷新调度 */
      expiresAt: number;
      userInfo: UserInfo;
    }

    interface UserInfo {
      userId: CommonType.IdType;
      userName: string;
      nickName: string;
      userAvatar: string;
      userEmail: string;
      userPhone: string;
      userGender: number;
      roleId: number;
      lastLogin: string;
      status: string;
      role: string;
      roles: string[];
      buttons: string[];
      deptName?: string;
      createTime?: string;
    }
  }
}
