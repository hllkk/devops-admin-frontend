/** The storage namespace */
declare namespace StorageType {
  interface Local {
    /** The i18n language */
    lang: App.I18n.LangType;
    /** Fixed sider with mix-menu */
    mixSiderFixed: CommonType.YesOrNo;
    /** Cookie-based auth flag */
    isAuthenticated: boolean;
    /** Token expiration timestamp (ms since epoch) for proactive refresh */
    tokenExpiresAt: number;
    /** The theme color */
    themeColor: string;
    /** The dark mode */
    darkMode: boolean;
    /** The theme settings */
    themeSettings: App.Theme.ThemeSetting;
    /**
     * The override theme flags
     *
     * The value is the build time of the project
     */
    overrideThemeFlag: string;
    /** The global tabs */
    globalTabs: App.Global.Tab[];
    /** The backup theme setting before is mobile */
    backupThemeSettingBeforeIsMobile: {
      layout: UnionKey.ThemeLayoutMode;
      siderCollapse: boolean;
    };
    /** The last login user id */
    lastLoginUserId: CommonType.IdType;
    /** The remember me flag */
    login_remember_me: boolean;
    /** The remembered username */
    remembered_user: string;
    /** The remembered password (XOR+base64 encoded) */
    remembered_pwd: string;
    /** The check db result cache */
    check_db_result: {
      needInit: boolean;
      timestamp: number;
    };
    /** The disk transfer list (persisted across refreshes) */
    diskTransferList: Api.Disk.TransferItem[];
  }
}
