export class ContentPackSourceNotFound extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ContentPackSourceNotFound";
	}
}

export class ContentPackInvalid extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ContentPackInvalid";
	}
}

export class ContentPackCollision extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ContentPackCollision";
	}
}

export class ContentPackConflict extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ContentPackConflict";
	}
}
