import DB from '../utils/db'
import AliUser from '../aliapi/user'
import message from '../utils/message'
import useUserStore, { ITokenInfo } from './userstore'
import {
  usePanTreeStore,
  usePanFileStore,
  useMyShareStore,
  useMyFollowingStore,
  useOtherFollowingStore,
  useAppStore,
  useFootStore,
  useSettingStore
} from '../store'
import PanDAL from '../pan/pandal'
import DebugLog from '../utils/debuglog'

export const UserTokenMap = new Map<string, ITokenInfo>()

export default class UserDAL {

  static async aLoadFromDB() {
    const tokenList = await DB.getUserAll()
    const defaultUser = await DB.getValueString('uiDefaultUser')
    let defaultUserAdd = false
    UserTokenMap.clear()
    try {
      for (const token of tokenList) {
        if (token.user_id && await AliUser.ApiTokenRefreshAccount(token, false)) {
          if (token.user_id === defaultUser) {
            defaultUserAdd = true
            await this.UserLogin(token).catch(() => {})
          } else if (token.user_id !== defaultUser && !defaultUserAdd) {
            defaultUserAdd = true
            await this.UserLogin(token).catch(() => {})
          }
        }
      }
    } catch (err: any) {
      DebugLog.mSaveDanger('aLoadFromDB loadUser', err)
    }
    console.log('defaultUserAdd', defaultUserAdd)
    if (!defaultUserAdd) {
      useUserStore().userShowLogin = true
    }
  }


  static async aRefreshAllUserToken() {
    const tokenList = await DB.getUserAll()
    const dateNow = new Date().getTime()
    for (let i = 0, maxi = tokenList.length; i < maxi; i++) {
      const token = tokenList[i]
      try {
        const expire_time = new Date(token.expire_time).getTime()
        // 每3小时自动刷新
        if (expire_time - dateNow < 1000 * 60 * 3) {
          await AliUser.ApiTokenRefreshAccount(token, false)
          await AliUser.OpenApiTokenRefreshAccount(token, false)
        }
        // 每1小时自动刷新
        if (expire_time - dateNow < 1000 * 60) {
          await AliUser.ApiSessionRefreshAccount(token,  false)
        }
      } catch (err: any) {
        DebugLog.mSaveDanger('aRefreshAllUserToken', err)
      }
    }
  }

  static GetUserToken(user_id: string): ITokenInfo {
    if (user_id && UserTokenMap.has(user_id)) return UserTokenMap.get(user_id)!

    return {
      tokenfrom: 'token',
      access_token: '',
      refresh_token: '',

      open_api_enable: false,
      open_api_access_token: '',
      open_api_refresh_token: '',

      expires_in: 0,
      token_type: '',
      user_id: '',
      user_name: '',
      avatar: '',
      nick_name: '',
      default_drive_id: '',
      default_sbox_drive_id: '',
      role: '',
      status: '',
      expire_time: '',
      state: '',
      pin_setup: false,
      is_first_login: false,
      need_rp_verify: false,
      name: '',
      spu_id: '',
      is_expires: false,
      used_size: 0,
      total_size: 0,
      spaceinfo: '',
      vipname: '',
      vipexpire: '',
      pic_drive_id: '',
      device_id: '',
      signature: ''
    }
  }

  static async GetUserTokenFromDB(user_id: string) {
    if (!user_id) return undefined
    if (UserTokenMap.has(user_id)) return UserTokenMap.get(user_id)
    const user = await DB.getUser(user_id)
    if (user) UserTokenMap.set(user.user_id, user)
    return user
  }


  static async ClearUserTokenMap() {
    UserTokenMap.clear()
  }

  static GetUserList() {
    const list: ITokenInfo[] = []
    // eslint-disable-next-line no-unused-vars
    for (const [_, token] of UserTokenMap) {
      list.push(token)
    }
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }


  static SaveUserToken(token: ITokenInfo) {
    if (token.user_id) {
      UserTokenMap.set(token.user_id, token)
      DB.saveUser(token)
        .then(() => {
          window.WinMsgToUpload({ cmd: 'ClearUserToken' })
          window.WinMsgToDownload({ cmd: 'ClearUserToken' })
        })
        .catch(() => {
        })
    }
  }


  static async UserLogin(token: ITokenInfo) {
    const loadingKey = 'userlogin_' + Date.now().toString()
    message.loading('加载用户信息中...', 0, loadingKey)
    UserTokenMap.set(token.user_id, token)

    // 加载用户信息
    await Promise.all([
        AliUser.ApiUserInfo(token),
        AliUser.ApiUserPic(token),
        AliUser.ApiUserVip(token)
    ])
    // 刷新session
    await AliUser.ApiSessionRefreshAccount(token, true)
    // 保存登录信息
    await DB.saveValueString('uiDefaultUser', token.user_id)
    useUserStore().userLogin(token.user_id)
    UserDAL.SaveUserToken(token)
    window.WebUserToken({
      user_id: token.user_id,
      name: token.user_name,
      access_token: token.access_token,
      login: true
    })
    useSettingStore().updateStore( {
      uiEnableOpenApi: token.open_api_enable,
      uiOpenApiAccessToken: token.open_api_access_token,
      uiOpenApiRefreshToken: token.open_api_refresh_token
    })
    useAppStore().resetTab()
    useMyShareStore().$reset()
    useMyFollowingStore().$reset()
    useOtherFollowingStore().$reset()
    useFootStore().mSaveUserInfo(token)

    PanDAL.aReLoadDrive(token.user_id, token.default_drive_id)
    PanDAL.aReLoadQuickFile(token.user_id)
    // PanDAL.aReLoadDirSizeFromDB(token.user_id, token.pic_drive_id)
    // PanDAL.GetAllDirList(token.user_id, token.pic_drive_id)

    message.success('加载用户成功!', 2, loadingKey)
  }


  static async UserLogOff(user_id: string): Promise<boolean> {
    DB.deleteUser(user_id)
    UserTokenMap.delete(user_id)


    let newUserID = ''
    for (const [user_id, token] of UserTokenMap) {
      const isLogin = token.user_id && (await AliUser.ApiTokenRefreshAccount(token, false))
      if (isLogin) {
        await this.UserLogin(token).catch(() => {
        })
        newUserID = user_id
        break
      }
    }

    if (!newUserID) {
      useUserStore().userLogOff()
      usePanTreeStore().$reset()
      usePanFileStore().$reset()
      useUserStore().userShowLogin = true
    }
    return newUserID != ''
  }

  static async UserClearFromDB(user_id: string): Promise<void> {
    DB.deleteUser(user_id)
    UserTokenMap.delete(user_id)
  }


  static async UserChange(user_id: string): Promise<boolean> {
    if (!UserTokenMap.has(user_id)) return false
    const token = UserTokenMap.get(user_id)!
    // 切换账号
    const isLogin = token.user_id && (await AliUser.ApiTokenRefreshAccount(token, false))
    if (!isLogin) {
      message.warning('该账号需要重新登陆[' + token.name + ']')
      DB.deleteUser(user_id)
      UserTokenMap.delete(user_id)
      return false
    }
    await this.UserLogin(token).catch(() => {})
    return true
  }


  static async UserRefreshByUserFace(user_id: string, force: boolean): Promise<boolean> {
    const token = UserDAL.GetUserToken(user_id)
    if (!token || !token.access_token) {
      return false
    }

    let time = Date.now() - (new Date(token.expire_time).getTime() - token.expires_in * 1000)
    time = time / 1000

    if (!force || time < 600) {
      await Promise.all([AliUser.ApiUserInfo(token), AliUser.ApiUserPic(token), AliUser.ApiUserVip(token)])
      UserDAL.SaveUserToken(token)
      return true
    } else {
      // 刷新token和session
      const isToken = token.user_id && (await AliUser.ApiTokenRefreshAccount(token, true))
      const isSession = token.user_id && (await AliUser.ApiSessionRefreshAccount(token, true))
      if (!isToken || !isSession) return false
      // 刷新用户信息
      await Promise.all([AliUser.ApiUserInfo(token), AliUser.ApiUserPic(token), AliUser.ApiUserVip(token)])
      useUserStore().userLogin(token.user_id)
      UserDAL.SaveUserToken(token)
      return true
    }
  }

  static async UserSign(user_id: string): Promise<boolean> {
    const token = UserDAL.GetUserToken(user_id)
    if (!token || !token.access_token) {
      return false
    }
    return AliUser.ApiUserSign(token)
  }
}
