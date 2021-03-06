///<reference path="../../.d.ts"/>
"use strict";

import helpers = require("../helpers");

export class LocalToDevicePathData implements Mobile.ILocalToDevicePathData {
	constructor(private localPath: string, private devicePath: string, private relativeToProjectBasePath: string) { }

	getLocalPath(): string { return this.localPath; }
	getDevicePath(): string { return this.devicePath; }
	getRelativeToProjectBasePath(): string { return this.relativeToProjectBasePath; }
}

export class MobileHelper implements Mobile.IMobileHelper {
	public generateLocalToDevicePathData(localPath: string, devicePath: string, relativeToProjectBasePath: string): Mobile.ILocalToDevicePathData {
		return new LocalToDevicePathData(localPath, devicePath, relativeToProjectBasePath);
	}

	private platformNamesCache: string[];

	constructor(private $mobilePlatformsCapabilities: Mobile.IPlatformsCapabilities,
		private $errors: IErrors,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants) { }

	public get platformNames(): string[]{
		this.platformNamesCache = this.platformNamesCache ||
			_.map(this.$mobilePlatformsCapabilities.getPlatformNames(), platform => this.normalizePlatformName(platform));

		return this.platformNamesCache;
	}

	public getPlatformCapabilities(platform: string): Mobile.IPlatformCapabilities {
		let platformNames = this.$mobilePlatformsCapabilities.getPlatformNames();
		let validPlatformName = this.validatePlatformName(platform);
		if(!_.any(platformNames, platformName => platformName === validPlatformName)) {
			this.$errors.failWithoutHelp("'%s' is not a valid device platform. Valid platforms are %s.", platform, platformNames);
		}

		return this.$mobilePlatformsCapabilities.getAllCapabilities()[validPlatformName];
	}

	public isAndroidPlatform(platform: string): boolean {
		return this.$devicePlatformsConstants.Android.toLowerCase() === platform.toLowerCase();
	}

	public isiOSPlatform(platform: string): boolean {
		return this.$devicePlatformsConstants.iOS.toLowerCase() === platform.toLowerCase();
	}

	public isWP8Platform(platform: string): boolean {
		return this.$devicePlatformsConstants.WP8.toLowerCase() === platform.toLowerCase();
	}

	public normalizePlatformName(platform: string): string {
		if(this.isAndroidPlatform(platform)) {
			return "Android";
		} else if(this.isiOSPlatform(platform)) {
			return "iOS";
		} else if(this.isWP8Platform(platform)) {
			return "WP8";
		}

		return undefined;
	}

	public isPlatformSupported(platform: string): boolean {
		return _.contains(this.getPlatformCapabilities(platform).hostPlatformsForDeploy, process.platform);
	}

	public validatePlatformName(platform: string): string {
		if(!platform) {
			this.$errors.fail("No device platform specified.");
		}

		let normalizedPlatform = this.normalizePlatformName(platform);
		if(!normalizedPlatform || !_.contains(this.platformNames, normalizedPlatform)) {
			this.$errors.fail("'%s' is not a valid device platform. Valid platforms are %s.",
				platform, helpers.formatListOfNames(this.platformNames));
		}
		return normalizedPlatform;
	}

}
$injector.register("mobileHelper", MobileHelper);
