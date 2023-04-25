<script setup lang="ts">
import MySwitch from "../layout/MySwitch.vue"
import useSettingStore from "./settingstore"
import AliUser from '../aliapi/user'
import { ref } from "vue"
import message from "../utils/message"
import { storeToRefs } from "pinia"

const settingStore = useSettingStore()
const qrCodeLoading = ref(false)
const qrCodeUrl = ref('')

const cb = (val: any) => {
    settingStore.updateStore(val)
}

const refreshQrCode = async () => {
    const { uiOpenApiClientId, uiOpenApiClientSecret } = storeToRefs(settingStore)
    if(!uiOpenApiClientId.value || !uiOpenApiClientSecret.value){
        message.error('客户端ID或客户端密钥不能为空！')
        return
    }
    qrCodeLoading.value = true
    const refresh = () => {
        if (qrCodeLoading.value) {
            setTimeout(refresh, 3000)
        }
    }
    setTimeout(refresh, 3000)
    AliUser.OpenApiQrCodeUrl(uiOpenApiClientId.value, uiOpenApiClientSecret.value).then(url => {
        qrCodeLoading.value = false
        qrCodeUrl.value = url
    }).catch(err => {
        qrCodeLoading.value = false
        qrCodeUrl.value = ''
        message.error('获取二维码失败')
    })
}

</script>

<template>
    <div class="settingcard">
        <div class="settinghead">:账号信息</div>

        <div class="settingspace"></div>
        <div class="settinghead">:阿里云盘开放平台</div>
        <div class="settingrow">
            <MySwitch :value="settingStore.uiEnableOpenApi" @update:value="cb({ uiEnableOpenApi: $event })">启用OpenApi（加快视频播放和下载）</MySwitch>
            <a-popover position="right">
                <i class="iconfont iconbulb" />
                <template #content>
                    <div style="min-width: 400px">
                        <span class="opred">OpenApi</span>：阿里云盘开放平台API
                        获取AccessToken后填入即可<br />
                        <div class="hrspace"></div>
                        <span class="opred">推荐</span>：采用AList提供的获取AccessToken的方式
                        <div class="hrspace"></div>
                        <span class="opred">AList官方文档</span>: <span class="opblue">https://alist.nn.ci/zh/guide/drivers/aliyundrive_open.html</span>
                    </div>
                </template>
            </a-popover>
            <div class="settingspace"></div>
            <a-radio-group v-if="settingStore.uiEnableOpenApi" type="button" tabindex="-1" :model-value="settingStore.uiOpenApi" @update:model-value="cb({ uiOpenApi: $event })">
                <a-radio tabindex="-1" value="qrCode">手机扫码</a-radio>
                <a-radio tabindex="-1" value="inputToken">手动输入</a-radio>
            </a-radio-group>
            <div class="settingspace"></div>
            <template v-if="settingStore.uiEnableOpenApi">
                <div v-if="settingStore.uiOpenApi === 'qrCode'">
                    <a-row class="grid-demo">
                        <a-col flex="252px">
                            <div class="settinghead">:客户端ID(ClientId)</div>
                            <div class="settingrow">
                                <a-input v-model.trim="settingStore.uiOpenApiClientId"
                                         :style="{ width: '168px' }"
                                         placeholder="客户端ID"
                                         @update:value="cb({ uiOpenApiClientId: $event })"
                                         allow-clear/>
                            </div>
                        </a-col>
                        <a-col flex="180px">
                            <div class="settinghead">:客户端密钥(ClientSecret)</div>
                            <div class="settingrow">
                                <a-input
                                    v-model.trim="settingStore.uiOpenApiClientSecret"
                                    :style="{ width: '168px' }"
                                    placeholder="客户端密钥"
                                    @update:value="cb({ uiOpenApiClientSecret: $event })"
                                    allow-clear/>
                            </div>
                        </a-col>
                    </a-row>
                    <div class="settingspace"></div>
                    <div class="settinghead">:二维码(手机客户端扫码)</div>
                    <div class="settingrow">
                        <a-button type="outline" size="small" tabindex="-1" :loading="qrCodeLoading" @click="refreshQrCode()">
                            <template #icon>
                                <i class="iconfont iconreload-1-icon" />
                            </template>
                            刷新二维码
                        </a-button>
                        <div class="settingspace"></div>
                        <a-image
                            width="200" height="200"
                            :preview="false"
                            :src="qrCodeUrl || 'some-error.png'"
                            :show-loader="qrCodeLoading"/>
                    </div>
                </div>
                <a-textarea v-if="settingStore.uiOpenApi === 'inputToken'"
                            v-model="settingStore.uiOpenApiToken"
                            @keydown="(e:any) => e.stopPropagation()"
                            :autoSize="{ minRows: 2 }"
                            tabindex="-1"
                            placeholder="访问AccessToken（无法自动刷新，有效期3个小时）"
                            allow-clear/>
            </template>
        </div>
    </div>
</template>

<style scoped>

</style>