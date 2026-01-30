'use strict'
const { chromium } = require('playwright-extra')
const stealth =
  require('puppeteer-extra-plugin-stealth').default || require('puppeteer-extra-plugin-stealth')
chromium.use(stealth())
module.exports = { chromium }
