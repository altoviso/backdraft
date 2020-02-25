let smokeOrder = 1;

const browserStackUser = process.env.BROWSER_STACK_USER || false;
const browserStackKey = process.env.BROWSER_STACK_KEY || false;
const browserStackServer = {
    provider: 'browserstack',
    url: 'http://hub-cloud.browserstack.com/wd/hub'
};

const testingBotKey = process.env.TESTINGBOT_KEY || false;
const testingBotSecret = process.env.TESTINGBOT_SECRET || false;

const testingBotServer = {
    name: 'testingbot',
    url: 'http://localhost:4445/wd/hub'
};

function getBrowserStackCaps(os, osVersion, browser, rest) {
    return {
        os,
        os_version: osVersion,
        browserName: browser,
        'browserstack.local': 'true',
        'browserstack.selenium_version': '3.5.2',
        'browserstack.console': 'verbose',
        'browserstack.user': browserStackUser,
        'browserstack.key': browserStackKey,
        provider: browserStackServer,
        smokeOrder: smokeOrder++,
        ...rest
    };
}

function getTestingBotCaps(platform, browserName, version, rest) {
    return {
        'selenium-version': '3.14.0',
        client_key: testingBotKey,
        client_secret: testingBotSecret,
        platform,
        browserName,
        version,
        provider: testingBotServer,
        smokeOrder: smokeOrder++,
        ...rest
    };
}

const caps = {
    chrome: {
        browserName: 'chrome',
        smokeOrder: smokeOrder++
    },
    firefox: {
        browserName: 'firefox',
        smokeOrder: smokeOrder++
    },
    safari: {
        browserName: 'safari',
        smokeOrder: smokeOrder++
    },
    tbchrome: getTestingBotCaps('WIN10', 'chrome', '68'),
    tbfirefox: getTestingBotCaps('WIN10', 'firefox', '61'),
    ipad: getBrowserStackCaps(undefined, '11.3', 'iPad', { device: 'iPad 6th', realMobile: 'true' })
};

['10', '8.1', '7'].forEach(version => {
    ['Chrome', 'Firefox', 'Edge', 'IE'].forEach(browser => {
        if (browser !== 'Edge' || version === '10') {
            const cap = getBrowserStackCaps('Windows', version, browser);
            caps[(`${browser}-win-${version}`).toLowerCase()] = cap;
            if (browser === 'Firefox') {
                cap.browser_version = '62.0 beta';
            }
        }
    });
});

['High Sierra', 'Sierra'].forEach(version => {
    ['Safari', 'Chrome', 'Firefox'].forEach(browser => {
        caps[(`${browser}-osx-${version.replace(/\s/g, '-')}`).toLowerCase().replace(' ')] = getBrowserStackCaps('OS X', version, browser);
    });
});

caps.presets = {
    default: ['firefox'],
    defaultRemote: ['firefox-win-10'],
    local: ['chrome', 'firefox'],
    osx: ['safari-os, x-high-sierra'],
    win7: ['firefox-win-7', 'ie-win-7', 'edge-win-7', 'chrome-win-7'],
    'win8.1': ['firefox-win-8.1', 'ie-win-8.1', 'edge-win-8.1', 'chrome-win-8.1'],
    win10: ['firefox-win-10', 'ie-win-10', 'edge-win-10', 'chrome-win-10'],
    sierra: ['firefox-osx-sierra', 'safari-osx-sierra', 'chrome-osx-sierra'],
    highSierra: ['firefox-osx-high-sierra', 'safari-osx-high-sierra', 'chrome-osx-high-sierra'],
    chrome: ['chrome-osx-high-sierra', 'chrome-osx-sierra', 'chrome-win-7', 'chrome-win-8.1', 'chrome-win-10'],
    firefox: ['firefox-osx-high-sierra', 'firefox-osx-sierra', 'firefox-win-7', 'firefox-win-8.1', 'firefox-win-10'],
    safari: ['safari-osx-high-sierra', 'safari-osx-sierra'],
    ie: ['ie-win-7', 'ie-win-8.1', 'ie-win-10'],
    edge: ['edge-win-10'],
    all: [
        'chrome-osx-high-sierra', 'chrome-osx-sierra', 'chrome-win-7', 'chrome-win-8.1', 'chrome-win-10',
        'firefox-osx-high-sierra', 'firefox-osx-sierra', 'firefox-win-7', 'firefox-win-8.1', 'firefox-win-10',
        'safari-osx-high-sierra', 'safari-osx-sierra',
        'ie-win-7', 'ie-win-8.1', 'ie-win-10',
        'edge-win-10'
    ]
};

module.exports = caps;
