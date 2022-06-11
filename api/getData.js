const { NFTPORT_API_KEY } = require('./config')
const { _, utils } = require('ifs')

module.exports = ({ ctx }) => {
  return async (dataType, url, params) => {
    const data = {
      chain: 'rinkeby',
      page_size: '50',
      include: 'metadata',
      ...params,
    }

    const paramsMd5 = utils.md5(`${url}${JSON.stringify(data)}`)
    const dbName = `nftPort_${dataType}`
    const isExist = await ctx.appDB(dbName).findLatestOne({
      paramsMd5
    })
    if (isExist) {
      const timeSpan = Date.now() - isExist.updatedAt
      const isNotExpired = timeSpan < 1000 * 60 * 5
      // const dataIsValidate = isExist.status === 200
      if (isNotExpired) {
        return {
          data: isExist.data,
          updatedAt: isExist.updatedAt
        }
      }
    }

    const rz = await ctx.http.request(url, {
      method: 'GET',
      contentType: 'json',
      dataType: 'json',
      headers: {
        "Authorization": NFTPORT_API_KEY
      },
      data
    })
    const updatedAt = Date.now()
    if (isExist) {
      await ctx.appDB(dbName).update({
        _id: isExist._id,
        body: {
          data: rz.data,
          status: rz.status,
          updatedAt
        }
      })
    } else {
      await ctx.appDB(dbName).create({
        query: {},
        data: {
          url,
          params: data,
          paramsMd5,
          data: rz.data,
          status: rz.status,
        }
      })
    }
    return {
      data: rz.data,
      updatedAt
    }
  }
}