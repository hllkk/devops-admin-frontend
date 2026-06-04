declare namespace Api {
  /**
   * namespace Auth
   *
   * backend api module: "auth"
   */
  namespace Auth {
    interface LoginToken {
      token?: string;
      refreshToken?: string;
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
      token?: string;
      refreshToken?: string;
      expiresAt?: number;
    }

    /** Combined login + user info response */
    interface LoginWithInfoResponse {
      token?: string;
      refreshToken?: string;
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
