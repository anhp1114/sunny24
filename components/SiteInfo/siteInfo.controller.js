const _ = require('lodash');

const SiteInfo = require('./siteInfo.model');

const getSiteInfo = async (req, res, next) => {
  try {
    const siteInfo = await SiteInfo.findOne();
    res.json({
        code: 1000,
        data: siteInfo
    });
  } catch (error) {
    console.log(`[ERROR] getSiteInfo: ${error.message}`)
  }
};

const updateSiteInfo = async (req, res, next) => {
    try {
        const siteInfo = await SiteInfo.findOne();
        if (!siteInfo) {
            await SiteInfo.create(req.body);
            return res.json({
                code: 1000,
                message: 'Create site info successfully'
            });
        }
        else {
            await SiteInfo.updateMany({}, req.body);
        }
        res.json({
            code: 1000,
            message: 'Update site info successfully'
        });
    } catch (error) {
        console.log(`[ERROR] updateSiteInfo: ${error.message}`)
    }
}
    

module.exports = {
  getSiteInfo,
  updateSiteInfo
};
