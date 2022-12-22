import conventionalChangelog from "conventional-changelog";
import fs from "node:fs";
import path from "node:path";
import minimist from "minimist";
import prompts from "prompts";
import { blue, green, red, yellow } from "kolorist";
import { sync } from "cross-spawn";
import { execSync } from "node:child_process";

const __DEV__ = false;

const __dirname = process.cwd();

const defaultConfig = {
	bump: {
		message: "release: %s",
		activePackages: ["test", "core"],
		publish: true,
	},
}.bump;

const argv = minimist<{
	v:
		| "major"
		| "minor"
		| "patch"
		| "premajor"
		| "preminor"
		| "prepatch"
		| string;
	package: string;
}>(process.argv.slice(2), { string: ["_"] });

function log(...args: any[]) {
	__DEV__ && console.log(blue(`[DEV] ${args}`));
}

function warn(...args: any[]) {
	console.log(yellow(`[WARN] ${args}`));
}

function error(...args: any[]) {
	console.log(red(`[ERROR] ${args}`));
}

const oldVersion = JSON.parse(
	fs.readFileSync(path.resolve(__dirname, "package.json"), "utf-8")
).version;

enum VersionType {
	MAJOR = "major",
	MINOR = "minor",
	PATCH = "patch",
	PRE_MAJOR = "premajor",
	PRE_MINOR = "preminor",
	PRE_PATCH = "prepatch",
	PRE_RELEASE = "prerelease",
	BETA = "beta",
	CANARY = "canary",
	RC = "rc",
}

function getType() {
	const patches = oldVersion.split(".").map(String)[2];
	const t = patches.split("-").map(String)[1];
	return t;
}

function getNewVersion(type: VersionType) {
	const [major, minor, patches, pre] = oldVersion.split(".").map(String);
	const [patch, tt] = patches.split("-").map(String);
	const t = tt || "alpha";
	switch (type) {
		case VersionType.MAJOR:
			return `${Number(major) + 1}.0.0`;
		case VersionType.MINOR:
			return `${Number(major)}.${Number(minor) + 1}.0`;
		case VersionType.PATCH:
			return `${Number(major)}.${Number(minor)}.${Number(patch) + 1}`;
		case VersionType.PRE_MAJOR:
			return `${Number(major) + 1}.0.0-${t}.0`;
		case VersionType.PRE_MINOR:
			return `${Number(major)}.${Number(minor) + 1}.0-${t}.0`;
		case VersionType.PRE_PATCH:
			return `${Number(major)}.${Number(minor)}.${
				Number(patch) + 1
			}-${t}.0`;
		case VersionType.PRE_RELEASE:
			if (pre !== undefined) {
				return `${Number(major)}.${Number(minor)}.${Number(
					patch
				)}-${t}.${Number(pre) + 1}`;
			}
			return `${Number(major)}.${Number(minor)}.${Number(patch)}-${t}.0`;
		case VersionType.BETA:
			return `${Number(major)}.${Number(minor)}.${Number(patch)}-beta.0`;
		case VersionType.CANARY:
			// eslint-disable-next-line prettier/prettier
			return `${Number(major)}.${Number(minor)}.${Number(patch)}-canary.0`;
		case VersionType.RC:
			return `${Number(major)}.${Number(minor)}.${Number(patch)}-rc.0`;
	}
}

async function generagteChoice() {
	const alphaRes = [
		{
			title: `Major - ${getNewVersion(VersionType.MAJOR)}`,
			value: VersionType.MAJOR,
		},
		{
			title: `Minor - ${getNewVersion(VersionType.MINOR)}`,
			value: VersionType.MINOR,
		},
		{
			title: `Patch - ${getNewVersion(VersionType.PATCH)}`,
			value: VersionType.PATCH,
		},
		{
			title: `Pre-Major - ${getNewVersion(VersionType.PRE_MAJOR)}`,
			value: VersionType.PRE_MAJOR,
		},
		{
			title: `Pre-Minor - ${getNewVersion(VersionType.PRE_MINOR)}`,
			value: VersionType.PRE_MINOR,
		},
		{
			title: `Pre-Patch - ${getNewVersion(VersionType.PRE_PATCH)}`,
			value: VersionType.PRE_PATCH,
		},
		getType() === "alpha" ||
		getType() === "beta" ||
		getType() === "canary" ||
		getType() === "rc"
			? {
					title: `Pre-Release - ${getNewVersion(
						VersionType.PRE_RELEASE
					)}`,
					value: VersionType.PRE_RELEASE,
			  }
			: undefined,
		getType() === "alpha"
			? {
					title: `Beta - ${getNewVersion(VersionType.BETA)}`,
					value: VersionType.BETA,
			  }
			: undefined,
		(getType() === "beta" && {
			title: `Canary - ${getNewVersion(VersionType.CANARY)}`,
			value: VersionType.CANARY,
		}) ||
			undefined,
		(getType() === "canary" && {
			title: `RC - ${getNewVersion(VersionType.RC)}`,
			value: VersionType.RC,
		}) ||
			undefined,
		{ title: "Custom Version", value: "custom" },
	];

	return alphaRes.filter((v) => v !== undefined);
}

function getPackages() {
	let packages: string[] = [];
	try {
		packages = fs.readdirSync(path.resolve(__dirname, "packages"));
	} catch (error) {
		error("No packages found, ARE YOU IN THE ROOT?");
		!__DEV__ && process.exit(1);
		__DEV__ && (packages = ["test", "test2", "core"]);
	}

	packages = packages
		.filter((v) => (activePackages ? activePackages.includes(v) : true))
		.filter((v) =>
			!__DEV__ ? isDir(path.resolve(__dirname, `packages/${v}`)) : true
		);

	return [
		{
			title: "All Packages",
			value: "all",
		},
		...packages.map((v) => {
			return {
				title: v,
				value: v,
			};
		}),
	];
}

function updatePackageJson(newVersion: string, name?: string) {
	let tpath: string;
	if (name) {
		tpath = path.resolve(__dirname, `packages/${name}/package.json`);
	} else {
		tpath = path.resolve(__dirname, `package.json`);
	}
	const packageJson = JSON.parse(fs.readFileSync(tpath, "utf-8"));
	packageJson.version = newVersion;
	fs.writeFileSync(tpath, JSON.stringify(packageJson, null, 2));
}

function getConfig() {
	let pkg;
	try {
		!__DEV__ &&
			(pkg = fs.readFileSync(
				path.resolve(__dirname, `package.json`),
				"utf-8"
			));
	} catch (error) {
		error(error);
		process.exit(1);
	}

	__DEV__ && (pkg = JSON.stringify(defaultConfig));
	const config = JSON.parse(pkg).bump as typeof defaultConfig;
	return config;
}

function isDir(path: string) {
	try {
		return fs.lstatSync(path).isDirectory();
	} catch (e) {
		return false;
	}
}

export const generateChangeLog = (
	options?: Parameters<typeof conventionalChangelog>[0]
) => {
	if (options) {
		Reflect.deleteProperty(options, "enable");
	}

	return new Promise<string>((resolve) => {
		let changelog = "# CHANGELOG\n\n";
		conventionalChangelog({
			preset: "angular",
			releaseCount: 0,
			skipUnstable: false,

			...options,
		})
			.on("data", (chunk: any) => {
				changelog += chunk.toString();
			})
			.on("end", () => {
				resolve(changelog);
			});
	});
};

const npm = "package-lock.json";
const yarn = "yarn.lock";
const pnpm = "pnpm-lock.yaml";
const lockFiles = [npm, yarn, pnpm];
function getPackageManager() {
	const pkgManager = lockFiles.find((v) => fs.existsSync(v));
	if (!pkgManager) {
		return "npm";
	} else {
		const pkg = pkgManager.split("-")[0];
		if (pkg === "package") {
			return "npm";
		}
		return pkg;
	}
}

const activePackages = __DEV__
	? defaultConfig.activePackages
	: getConfig()?.activePackages;

async function main() {
	console.clear();
	if (argv.package && !activePackages?.includes(argv.package)) {
		error(`Package ${argv.package} is not active`);
		process.exit(1);
	}
	const gitStatus = execSync("git status --porcelain").toString();
	if (gitStatus && !__DEV__) {
		error("You have uncommited changes, please commit them first");
		process.exit(1);
	}
	console.log(`Current Directory: ${green(__dirname)}`);
	console.log(`Current Version: ${green(oldVersion)}`);
	console.log(`Active Packages: ${green(activePackages?.join(", "))}`);
	console.log(`Package Manager: ${green(getPackageManager())}`);
	let _mode: prompts.Answers<
		"mode" | "custom" | "packages" | "publish" | "changelog"
	>;
	log(getConfig());
	try {
		_mode = await prompts(
			[
				{
					type: argv.v ? null : "select",
					name: "mode",
					message: `Select a version`,
					choices: await generagteChoice(),
				},
				{
					type: (_, { mode }) => (mode === "custom" ? "text" : null),
					name: "custom",
					message: "Enter a custom version",
				},
				{
					type: "multiselect",
					name: "packages",
					message: "Select packages",
					choices: getPackages().map((v) => {
						return {
							title: v.title,
							value: v.value,
							selected: v.value === argv.package,
						};
					}),
				},
				{
					type: "confirm",
					name: "publish",
					message: "Publish to NPM?",
					initial: getConfig()?.publish || false,
				},
				{
					type: "confirm",
					name: "changelog",
					message: "Generate Changelog?",
					initial: true,
				},
			],
			{
				onCancel: () => {
					process.exit(0);
				},
			}
		);
	} catch (e) {
		error(e);
	}

	const { mode, custom, packages: pkgs, publish, changelog } = _mode;
	let thePkg = (pkgs as string[]) || argv.package || "all";
	if (thePkg.length === 0) thePkg = "all";
	let newVersion: string;
	if (mode === "custom") {
		newVersion = custom;
	} else {
		newVersion = getNewVersion(mode);
	}

	// 检查 thePkg 是否与 activePackages 有交集
	if (activePackages) {
		const pkg = typeof thePkg === "string" ? [thePkg] : thePkg;
		if (pkg.join() !== "all") {
			const intersection = pkg.filter((v) => activePackages.includes(v));
			if (intersection.length === 0) {
				error(
					`The selected packages are not in the activePackages list, please check the configuration file`
				);
				process.exit(1);
			}
		}
	}
	if ((typeof thePkg === "object" ? thePkg.join("") : thePkg) === "all") {
		log(`# Updating all packages to: ${newVersion}`);
		const packages = getPackages();
		for (const p of packages) {
			if (p.value === "all") continue;
			if (
				activePackages &&
				activePackages.length &&
				!activePackages.includes(p.value)
			) {
				warn(
					`You have configured activePackages to to skip ${p.value}`
				);
				continue;
			}
			log(`# Updating \`${p.value}\` package version to: ${newVersion}`);
			!__DEV__ && updatePackageJson(newVersion, p.value);
		}
	} else {
		// have checked thePkg is in activePackages
		for (const p of thePkg) {
			log(`$ Updating \`${p}\` package version to: ${newVersion}`);
			!__DEV__ && updatePackageJson(newVersion, p);
		}
	}

	log(`$ Updating root package version to: ${newVersion}`);
	!__DEV__ && updatePackageJson(newVersion); // update root package.json

	changelog && log(`$ generating changelog`);
	!__DEV__ &&
		changelog &&
		(await generateChangeLog().then((changelog) => {
			fs.writeFileSync("CHANGELOG.md", changelog);
		}));
	!__DEV__ && sync("git", ["add", "CHANGELOG.md"], { stdio: "inherit" });

	console.log(`$ git add .`);
	!__DEV__ && sync("git", ["add", "."], { stdio: "inherit" });

	const message = String(
		getConfig()?.message?.replace("%s", newVersion) ||
			defaultConfig.message.replace("%s", newVersion)
	);
	console.log(`$ git commit -am "${message}" --no-verify`);
	!__DEV__ &&
		sync("git", ["commit", "-am", message, "--no-verify"], {
			stdio: "inherit",
		});

	console.log(`$ git tag -a ${newVersion} -m "${message}`);
	!__DEV__ &&
		sync("git", ["tag", "-a", newVersion, "-m", message], {
			stdio: "inherit",
		});

	console.log(`$ git push`);
	!__DEV__ && sync("git", ["push"], { stdio: "inherit" });

	console.log(`$ git push --tags`);
	!__DEV__ && sync("git", ["push", "--tags"], { stdio: "inherit" });

	if (publish) {
		const publishCmd = `${getPackageManager()} publish`;
		if ((typeof thePkg === "object" ? thePkg.join("") : thePkg) === "all") {
			const packages = getPackages();
			for (const p of packages) {
				if (p.value === "all") continue;
				if (
					activePackages.length &&
					!activePackages.includes(p.value)
				) {
					warn(
						`You have configured activePackages to to skip ${p.value}`
					);
					continue;
				}
				console.log(`$ cd packages/${p.value} && ${publishCmd}`);
				!__DEV__ && sync("cd", ["packages", p.value, "&&", publishCmd]);
			}
		} else {
			// have checked thePkg is in activePackages
			for (const p of thePkg) {
				console.log(`$ cd packages/${p} && ${publishCmd}`);
				!__DEV__ && sync("cd", ["packages", p, "&&", publishCmd]);
			}
		}
	}

	console.log(green(`Version bumped to ${newVersion}`));
}

main().catch((e) => {
	console.error(e);
	console.log(red("Something went wrong!"));
	// !__DEV__ &&
	// 	sync("git", ["reset", "--hard", "HEAD~1"], { stdio: "inherit" });
});
