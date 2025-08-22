export type FlatTree = {
	[Node: string]: string[];
};

export type HierarchicalTree = {
	self: string;
	children?: HierarchicalTree;
}[];

export function flat<
	THierarchicalTree extends HierarchicalTree,
>(
	h: THierarchicalTree,
): FlatTree {
	return Object.fromEntries(
		h.flatMap(function (node): [string, string[]][] {
			return [
				[
					node.self,
					node.children?.flatMap((child) => child.self) ??
						[],
				],
				...Object.entries(flat(node.children ?? [])),
			];
		}).filter(([, children]) => children.length > 0),
	) as FlatTree;
}

// {A: [B, C], B: [D]} -> [[A, [[B, [D]], [C]]]] -> [{self: A, children: [{self: B, children: [{self: D}]}, {self: C}]}]
export function hierarchical<
	TFlatTree extends FlatTree,
>(
	f: TFlatTree,
): HierarchicalTree {
	const refCounts = Object.fromEntries(
		Object.keys(f).map((key) => [key, 0]),
	);

	type AuxTree = [string, AuxTree][];
	function buildAuxTree(keys: string[]): AuxTree {
		return keys.map(function (key) {
			refCounts[key]++;
			return [key, f[key] ? buildAuxTree(structuredClone(f[key])) : []];
		});
	}

	const filteredRoots = buildAuxTree(Object.keys(f)).filter(
		([key]) => refCounts[key] <= 1,
	);

	function convertToHierarchical(auxTree: AuxTree): HierarchicalTree {
		return auxTree.map(function ([key, children]) {
			return {
				self: key,
				...(children.length > 0 && {
					children: convertToHierarchical(children),
				}),
			};
		});
	}

	return convertToHierarchical(filteredRoots);
}
