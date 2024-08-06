const md5 = require('md5');
const axios = require('axios').default;

const PATH = '/payment/direct';
const METHOD = 'POST';
const X_API_CLIENT = process.env.PAYME_X_API_CLIENT;
const SECRET_KEY = process.env.PAYME_SECRET_KEY
const HOST = process.env.PAYME_HOST

const createPayment = async (payload) => {
    try {
        const xAPIValidate = md5(
            PATH +
            METHOD +
            JSON.stringify(payload) +
            SECRET_KEY
        );
        const headers = {
            'x-api-client': X_API_CLIENT,
            'x-api-validate': xAPIValidate,
        };
        const url = `${HOST}${PATH}`;

        console.log(`[INFO] PAYME CREATE PAYMENT params: ${JSON.stringify(payload)}, headers: ${JSON.stringify(headers)}`);
        result = await axios.post(url, payload, {
            headers
        });
        console.log(`[INFO] PAYME CREATE PAYMENT result: ${JSON.stringify(result?.data)}`);
        return result?.data;

    } catch (error) {
        console.log(`[ERROR] PAYME CREATE PAYMENT: ${error.message}`);
        return {};
    }
}

module.exports = {
    createPayment
}