export default {
	resetPassword: (url: string) => ({
		subject: "重设你的 REZICS 密码",
		text: `请在一小时内打开以下链接以重设密码：${url}`,
	}),
	verifyEmail: (url: string) => ({
		subject: "验证你的 REZICS 邮箱",
		text: `请打开以下链接完成邮箱验证：${url}`,
	}),
};
