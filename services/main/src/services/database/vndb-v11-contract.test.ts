import { describe, expect, it } from "vitest";

import {
	VndbV11BinaryContractConnectionConfig,
	VndbV11BinaryContractSetting,
	VndbV11BinaryContractStartupOption,
	VndbV11BinaryContractValue,
} from "./vndb-v11-contract";

describe("VNDB v11 binary contract connection fence", () => {
	it("sets the fixed contract identity on every backend connection", () => {
		expect(VndbV11BinaryContractSetting).toBe("rezics.vndb_v11_binary_contract");
		expect(VndbV11BinaryContractValue).toBe("vndb-v11-contract-v1");
		expect(VndbV11BinaryContractStartupOption).toBe(
			"-c rezics.vndb_v11_binary_contract=vndb-v11-contract-v1",
		);
		expect(VndbV11BinaryContractConnectionConfig.options).toBe(VndbV11BinaryContractStartupOption);
	});
});
