import chalk from 'chalk';
import path from 'path';
import proxyChain from 'proxy-chain';
import puppeteer from 'puppeteer-extra';
import userAgentPlugin from 'puppeteer-extra-plugin-stealth/evasions/user-agent-override/index.js';
import { print, sleep } from './utils.js';

const extensionId = 'caacbgbklghmpodbdafajbgdnegacfmo';

let ChromeLauncher;
import('chrome-launcher').then((module) => {
    ChromeLauncher = module;
});

const waitChromeLoaded = async () => {
    return new Promise((resolve, reject) => {
        if (ChromeLauncher) {
            resolve();
        } else {
            const check = setInterval(() => {
                if (ChromeLauncher) {
                    clearInterval(check);
                    resolve();
                }
            }, 100);
            setTimeout(() => {
                clearInterval(check);
                reject(new Error('ChromeLauncher failed to load'));
            }, 10000);
        }
    });
}

const exec = async (wallet) => {
    const chromePath = ChromeLauncher.Launcher.getInstallations();
    puppeteer.use(userAgentPlugin({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36' }));
    let gradientEx = path.resolve(`./${extensionId}/1.0.18_0`);
    const argArr = [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--no-startup-window',
        '--no-first-run',
        '--disabled-setupid-sandbox',
        '--disable-infobars',
        '--webrtc-ip-handling-policy=disable_non_proxied_udp',
        '--force-webrtc-ip-handling-policy',
    ];
    const newProxyUrl = await proxyChain.anonymizeProxy(wallet.proxyUrl)
    argArr.push('--disable-extensions-except=' + gradientEx);
    argArr.push('--proxy-server=' + newProxyUrl);
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: chromePath[0],
        ignoreDefaultArgs: ['--enable-automation'],
        defaultViewport: null,
        args: argArr,
        waitForInitialPage: false,
    });

    // 监听浏览器关闭事件
    browser.on('disconnected', async () => {
        // console.log(chalk.red('Browser disconnected.'));
    });

    browser.on('targetdestroyed', async target => {
        if (await target.type() === 'page' && (await browser.pages()).length === 0) {
            // console.log(chalk.red('Browser destroyed.'));
        }
    });
    try {
        const pages = await browser.pages();
        if (pages.length > 1) {
            for (let i = 1; i < pages.length; i++) {
                await pages[i].close();
            }
        }

        print(chalk.yellow('检测ip...'));
        const ipPage = await browser.newPage();
        await ipPage.goto('https://myip.ipip.net');
        await ipPage.bringToFront();
        const ipInfoText = await ipPage.$eval('body', element => element.textContent);
        print(chalk.green(ipInfoText));
        await ipPage.close();


        print(chalk.yellow('登录ing...'));
        const loginPage = await browser.newPage();
        await loginPage.goto('https://app.gradient.network/');
        await loginPage.bringToFront();

        const emailSelector = '[placeholder="Enter Email"]';
        const passwordSelector = '[type="password"]';
        const loginBtn = 'button';

        await loginPage.waitForSelector(emailSelector, { timeout: 30000 });
        await loginPage.type(emailSelector, wallet.email);

        await loginPage.waitForSelector(passwordSelector, { timeout: 30000 });
        await loginPage.type(passwordSelector, wallet.password);

        await loginPage.waitForSelector(loginBtn, { timeout: 30000 });
        await loginPage.click(loginBtn);

        await loginPage.waitForSelector('a[href="/dashboard/setting"]', 30000);
        await loginPage.close();

        print(chalk.yellow('打开插件ing...'));
        const extensionPage = await browser.newPage();
        await extensionPage.goto(`chrome-extension://${extensionId}/popup.html`);
        await extensionPage.bringToFront();

        try {
            const gotItButton = await extensionPage.waitForSelector('xpath//html/body/div[2]/div/div[2]/div/div[2]/div/div/div/button', 30000);
            await gotItButton.click()
            print(chalk.green('-> "我知道了"按钮已点击!'))
        } catch (error) {
            print(chalk.red('-> 未找到 "我知道了" 按钮!(跳过)'))
        }
        await sleep(3000);
        await extensionPage.reload();

        let timer;
        const checkStatus = async () => {
            try {
                // await extensionPage.reload();
                await extensionPage.waitForSelector('.absolute.mt-3.right-0.z-10', 30000);
                const supportStatus = await extensionPage.evaluate(() => document.querySelector('.absolute.mt-3.right-0.z-10').textContent);
                if (supportStatus === 'Good') {
                    print(`✅ [${wallet.email}]状态：${chalk.green(supportStatus)}`);
                } else {
                    print(`❌ [${wallet.email}]状态：${chalk.red(supportStatus)}`);
                    print(chalk.yellow('清除定时器'));
                    clearInterval(timer);
                    print(chalk.yellow('关闭浏览器'));
                    browser.close();
                    await exec(wallet);
                }
            } catch (error) {
                print(`❌ [${wallet.email}] 状态异常`);
                print(chalk.yellow('清除定时器'));
                clearInterval(timer);
                print(chalk.yellow('关闭浏览器'));
                browser.close();
                await exec(wallet);
            }
        }
        timer = setInterval(checkStatus, 1 * 60 * 1000);
        await checkStatus();
    } catch (error) {
        print(chalk.yellow(`${wallet.email} 5s 后重新启动...`))
        await sleep(5000);
        browser.close();
        await exec(wallet);
    }
}

const loop = async (list) => {
    list.forEach((wallet, index) => {
        print(chalk.yellow(`⏳ 序号: ${index} ${wallet?.email} ing...`));
        exec(wallet);
    });
}

(async () => {
    await waitChromeLoaded();
    loop([
        
    ]);
})();