module.exports = {
  isPublic: true,
  run: async (ctx) => {
    const { query } = ctx
    const { userWalletAddress } = query

    const nftPortGetData = ctx.getModel('nftPort/getData')
    const url = `https://api.nftport.xyz/v0/accounts/${userWalletAddress}`
    const params = {}

    const userWalletNftData = await nftPortGetData('userWallet', url, params)
    return userWalletNftData
  }
}