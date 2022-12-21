import conventionalChangelog from "conventional-changelog";
import fs from "node:fs";
import path from "node:path";
import minimist from "minimist";
import prompts from "prompts";
import { green, red } from "kolorist";
import spawnSync, { spawn } from "cross-spawn";
import { execSync } from "node:child_process";

const __DEV__ = false;

const __dirname = process.cwd();

const defaultConfig = {
	bump: {
		message: "release: %s",
		preCommit: [],
		afterPush: [],
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

const oldVersion = argv.package
	? JSON.parse(
			fs.readFileSync(
				path.resolve(
					__dirname,
					`packages/${argv.package}/package.json`
				),
				"utf-8"
			)
	  ).version
	: JSON.parse(
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
	let packages;
	try {
		packages = fs
			.readdirSync(path.resolve(__dirname, "packages"))
			.filter((v) => v !== ".DS_Store");
	} catch (error) {
		console.log(red("No packages found, ARE YOU IN THE ROOT?"));
		!__DEV__ && process.exit(1);
		__DEV__ && (packages = ["test"]);
	}
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
	let tpath;
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
		console.log(error);
		process.exit(1);
	}
	__DEV__ && (pkg = JSON.stringify(defaultConfig));
	const config = JSON.parse(pkg).bump as typeof defaultConfig;
	return config;
}

async function main() {
	console.clear();
	const gitStatus = execSync("git status --porcelain").toString();
	if (gitStatus && !__DEV__) {
		console.log(red("Please commit all changes before bumping version"));
		process.exit(1);
	}
	console.log(`Current Directory: ${__dirname}`);
	console.log(`Current Version: ${oldVersion}`);
	let _mode: prompts.Answers<
		"mode" | "custom" | "package" | "publish" | "generateChangelog"
	>;
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
					type: argv.package ? null : "select",
					name: "package",
					message: "Select a package",
					choices: getPackages(),
				},
				{
					type: "confirm",
					name: "publish",
					message: "Publish to NPM?",
					initial: false,
				},
				{
					type: "confirm",
					name: "generateChangelog",
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
		console.log(e);
	}

	const { mode, custom, package: pkg, publish, generateChangelog } = _mode;
	const thePkg = pkg || argv.package;
	let newVersion;
	if (mode === "custom") {
		newVersion = custom;
	} else {
		newVersion = getNewVersion(mode);
	}

	if (thePkg === "all") {
		console.log(`$ Updating root package version to: ${newVersion}`);
		!__DEV__ && updatePackageJson(newVersion);
		const packages = getPackages();
		for (const p of packages) {
			if (p.value === "all") continue;
			console.log(
				`# Updating \`${p.value}\` package version to: ${newVersion}`
			);
			!__DEV__ && updatePackageJson(newVersion, p.value);
		}
	} else {
		console.log(`$ Updating ${thePkg} package version to: ${newVersion}`);
		!__DEV__ && updatePackageJson(newVersion, thePkg);
	}
	console.log(`$ git add .`);
	!__DEV__ && spawnSync("git", ["add", "."], { stdio: "inherit" });

	const message = String(
		getConfig()?.message?.replace("%s", newVersion) ||
			defaultConfig.message.replace("%s", newVersion)
	);
	console.log(`$ git commit -am "${message}" --no-verify`);
	!__DEV__ &&
		spawnSync("git", ["commit", "-am", message, "--no-verify"], {
			stdio: "inherit",
		});

	console.log(`$ git tag -a ${newVersion} -m "${message}`);
	!__DEV__ &&
		spawnSync("git", ["tag", "-a", newVersion, "-m", message], {
			stdio: "inherit",
		});

	__DEV__ && console.log(`$ generating changelog`);
	!__DEV__ &&
		generateChangelog &&
		conventionalChangelog({
			preset: "angular",
			releaseCount: 0,
			skipUnstable: false,
		}).pipe(fs.createWriteStream("CHANGELOG.md"));
	!__DEV__ && spawnSync("git", ["add", "CHANGELOG.md"], { stdio: "inherit" });
	!__DEV__ &&
		spawnSync("git", ["commit", "--amend", "--no-edit"], {
			stdio: "inherit",
		});

	console.log(`$ git push`);
	!__DEV__ && spawnSync("git", ["push"], { stdio: "inherit" });

	console.log(`$ git push --tags`);
	!__DEV__ && spawnSync("git", ["push", "--tags"], { stdio: "inherit" });

	if (publish) {
		const publishCmd = `npm publish`;
		if (thePkg === "all") {
			const packages = getPackages();
			for (const p of packages) {
				if (p.value === "all") continue;
				console.log(`$ cd packages/${p.value} && ${publishCmd}`);
				!__DEV__ &&
					spawnSync("cd", ["packages", p.value, "&&", publishCmd]);
			}
		} else {
			console.log(`$ cd packages/${thePkg} && ${publishCmd}`);
			!__DEV__ && spawnSync("cd", ["packages", thePkg, "&&", publishCmd]);
		}
	}

	console.log(green(`Version bumped to ${newVersion}`));
}

main().catch((e) => {
	console.error(e);
	console.log(red("Something went wrong!"));
	!__DEV__ &&
		spawnSync("git", ["reset", "--hard", "HEAD~1"], { stdio: "inherit" });
});
