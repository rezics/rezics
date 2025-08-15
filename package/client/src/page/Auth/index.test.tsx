import { Layout } from "./lib/Layout";
import { Login } from "./Login";
import { Register } from "./Register";

export default {
	layout: (
		<Layout
			title="Layout"
			onSubmit={alert}
			content={"content"}
			actions={"actions"}
		>
		</Layout>
	),
	login: <Login></Login>,
	register: <Register></Register>,
};
