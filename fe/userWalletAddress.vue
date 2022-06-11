<template>
  <view class="text-base">
    <view class="pb-10 header">
      <view class="flex text-center px-10 pt-10 items-center justify-between">
        <image :src="avatarUrl" class="rounded-full h-20 w-20"></image>
        <view>
          <view class="font-bold text-4xl">{{ collectionCount }}</view>
          <view>collections</view>
        </view>
        <view>
          <view class="font-bold text-4xl">{{ nftCount }}</view>
          <view>NFTs</view>
        </view>
      </view>
    </view>
    <view class="list grid gap-1 grid-cols-3">
      <view v-for="(item, index) in nfts" :key="index" @tap="preview(index)">
        <u--image :src="item.file_url" mode="widthFix" :fade="true" duration="450" width="248rpx" height="248rpx">
          <template v-slot:loading>
            <u-loading-icon color="blue"></u-loading-icon>
          </template>
        </u--image>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  computed: {
    avatarUrl() {
      if (this.nfts.length === 0) {
        return '/static/imgs/logo-blue.png'
      }
      const index = Math.floor(this.nftCount * Math.random())
      return this.nfts[index].file_url
    },
    collectionCount() {
      let contractList = {}
      this.nfts.forEach(item => {
        contractList[item.contract_address] = true
      })
      return Object.keys(contractList).length
    },
    nftCount() {
      return this.nfts.length
    },
    urls() {
      return this.nfts.map(item => item.file_url)
    }
  },
  data() {
    return {
      nfts: [],
      updatedAt: Date.now(),
    }
  },
  onPullDownRefresh() {
    this.initData()
  },
  methods: {
    async initData() {
      const userWalletAddress = this.$opts.userWalletAddress
      const rz = await this.$ifsApi('w3ns/userWalletAddress', { userWalletAddress })
      this.nfts = rz.result.data.nfts.filter(item => item.file_url)
      this.updatedAt = rz.result.updatedAt
    },
    preview(current) {
      uni.previewImage({
        current,
        urls: this.urls,
        // longPressActions: {
        // 	itemList: ['发送给朋友', '保存图片', '收藏'],
        // 	success: function (data) {
        // 		console.log('选中了第' + (data.tapIndex + 1) + '个按钮,第' + (data.index + 1) + '张图片');
        // 	},
        // 	fail: function (err) {
        // 		console.log(err.errMsg);
        // 	}
        // }
      });
    }
  }
}
</script>