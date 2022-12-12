enum VersionType {
    "release",
    "snapshot",
    "old_alpha",
    "old_beta"
}

type SmallVersionInfo = {
    id: string,
    type: VersionType,
    url: string,
    time: string,
    releaseTime: string,
    sha1: string,
    complianceLevel: boolean
};

type JavaVersion = {
    component: string,
    majorVersion: number
}

type AssetIndex = {
    id: string,
    sha1: string,
    size: number,
    totalSize: number,
    url: string
}

type DownloadArtifact = {
    sha1: string,
    size: number,
    url: string
}

type Downloads = {
    client: DownloadArtifact,
    client_mappings: DownloadArtifact,
    server: DownloadArtifact,
    server_mappings: DownloadArtifact
}

type Rule = {
    action: string,
    features: {
        is_demo_user: boolean | undefined,
        has_custom_resolution: boolean | undefined
    } | undefined,
    os: {
        name: string | undefined,
        version: string | undefined,
        arch: string | undefined
    } | undefined
}

type Argument = string | {
    rules: Rule[],
    value: string | string[]
}

type LibraryDownload = {
    path: string,
    sha1: string,
    size: number,
    url: string
}

type Library = {
    name: string,
    downloads: {
        artifact: LibraryDownload
    },
    rules: Rule[] | undefined
}

type FullVersionInfo = {
    arguments: {
        game: Argument[],
        jvm: Argument[]
    },
    assetIndex: AssetIndex,
    assets: string,
    complianceLevel: boolean,
    downloads: Downloads,
    id: string,
    javaVersion: JavaVersion,
    libraries: Library[],
    logging: {
        client: {
            argument: string,
            file: {
                id: string,
                sha1: string,
                size: number,
                url: string
            },
            type: string
        }
    },
    mainClass: string,
    minimumLauncherVersion: number,
    releaseTime: string,
    time: string,
    type: VersionType
};

import * as fs from "https://deno.land/std@0.155.0/fs/mod.ts";

const decoder = new TextDecoder("utf-8");
const encoder = new TextEncoder();

const versionListUrl = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const versionList: SmallVersionInfo[] = (await (await fetch(versionListUrl)).json())["versions"];

const libList: Record<string, Record<string, Record<string, unknown[]>>> = {}

for (let i = 0; i < versionList.length; i++) {
    const versionInfoSmall = versionList[i];
    const maxVersionInfo = await (await fetch(versionInfoSmall.url)).json();

    for (let j = 0; j < maxVersionInfo.libraries.length; j++) {
        const lib = maxVersionInfo.libraries[j];
        const parts = lib.name.split(":");
        const group = parts[0];
        const name = parts[1];
        const version = parts[2];

        if (!Object.hasOwn(libList, group)) {
            libList[group] = {};
        }

        if (!Object.hasOwn(libList[group], name)) {
            libList[group][name] = {};
        }

        if (!Object.hasOwn(libList[group][name], version)) {
            libList[group][name][version] = [];
        }

        let br = false;

        for (let k = 0; k < libList[group][name][version].length; k++) {
            if (JSON.stringify(libList[group][name][version][k]) == JSON.stringify(lib)) {
                br = true;
                break
            }
        }

        if (br) continue

        if (!libList[group][name][version].includes(lib)) {
            libList[group][name][version].push(lib);
        }
    }
}

if (await fs.exists("./libs")) {
    await fs.emptyDir("./libs")
} else {
    await Deno.mkdir("./libs");
}

for (const group in libList) {
    const gPath = `./libs/${
        group.includes(".") ? group.replaceAll(".", "/") : group
    }`;
    
    if (!group.includes(".")) {
        if (!await fs.exists(gPath)) {
            await Deno.mkdir(gPath);
        }
    } else {
        const pats = group.split(".");
        let pat = "./libs";
        for (let i = 0; i < pats.length; i++) {
            pat += "/" + pats[i];

            if (!await fs.exists(pat)) {
                await Deno.mkdir(pat);
            }
        }
    }

    for (const name in libList[group]) {
        const nPath = gPath + `/${name}`;

        if (!await fs.exists(nPath)) {
            await Deno.mkdir(nPath);
        }

        for (const version in libList[group][name]) {
            const libs = libList[group][name][version];

            await Deno.writeFile(nPath + `/${version}.json`, encoder.encode(JSON.stringify(libs, undefined, 4)));
        }
    }
}
