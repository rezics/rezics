export const VndbV11CutoverAdvisoryLockKey = 71_011_001n as const;

export const VndbV11BinaryContractSetting = "rezics.vndb_v11_binary_contract";
export const VndbV11BinaryContractValue = "vndb-v11-contract-v1";
export const VndbV11BinaryContractStartupOption = `-c ${VndbV11BinaryContractSetting}=${VndbV11BinaryContractValue}`;

export const VndbV11BinaryContractConnectionConfig = {
	options: VndbV11BinaryContractStartupOption,
} as const;
