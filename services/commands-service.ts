///<reference path="../../.d.ts"/>

var jaroWinklerDistance = require("../vendor/jaro-winkler_distance");
import helpers = require("./../helpers");

export class CommandsService implements ICommandsService {
	constructor(private $errors: IErrors,
				private $logger: ILogger,
				private $injector: IInjector) { }

	public allCommands(includeDev: boolean): string[]{
		var commands = this.$injector.getRegisteredCommandsNames(includeDev);
		return _.reject(commands, (command) => _.contains(command, '|'));
	}

	public executeCommandUnchecked(commandName: string, commandArguments: string[],  beforeExecuteCommandHook?: (command: ICommand, commandName: string) => void): boolean {
		var command = this.$injector.resolveCommand(commandName);
		if (command) {
			if(beforeExecuteCommandHook) {
				beforeExecuteCommandHook(command, commandName);
			}
			command.execute(commandArguments).wait();
			return true;
		} else {
			return false;
		}
	}

	public executeCommand(commandName: string, commandArguments: string[],  beforeExecuteCommandHook?: (command: ICommand, commandName: string) => void): boolean {
		return this.$errors.beginCommand(
			() => this.executeCommandUnchecked(commandName, commandArguments),
			() => this.executeCommandUnchecked("help", [this.beautifyCommandName(commandName)]));
	}

	public tryExecuteCommand(commandName: string, commandArguments: string[], beforeExecuteCommandHook?: (command: ICommand, commandName: string) => void): void {
		if(!this.executeCommand(commandName, commandArguments)) {
			this.$logger.fatal("Unknown command '%s'. Use 'appbuilder help' for help.", helpers.stringReplaceAll(commandName, "|", " "));
			this.tryMatchCommand(commandName);
		}
	}

	private tryMatchCommand(commandName: string): void {
		var allCommands = this.allCommands(false);
		var similarCommands = [];
		_.each(allCommands, (command) => {
			if(!this.$injector.isDefaultCommand(command)) {
				command = helpers.stringReplaceAll(command, "|", " ");
				var distance = jaroWinklerDistance(commandName, command);
				if (commandName.length > 3 && command.indexOf(commandName) != -1) {
					similarCommands.push({ rating: 1, name: command });
				} else if (distance >= 0.65) {
					similarCommands.push({ rating: distance, name: command });
				}
			}
		});

		similarCommands = _.sortBy(similarCommands, (command) => {
			return -command.rating;
		}).slice(0, 5);

		if (similarCommands.length > 0) {
			var message = ["Did you mean?"];
			_.each(similarCommands, (command) => {
				message.push("\t" + command.name);
			});
			this.$logger.fatal(message.join("\n"));
		}
	}

	public completeCommand(propSchema?: any): IFuture<any> {
		return (() => {
			var tabtab = require("tabtab");
			tabtab.complete("appbuilder", (err, data) => {
				if (err || !data) {
					return;
				}

				var deviceSpecific = ["build", "deploy"];
				var propertyCommands = ["print", "set", "add", "del"];
				var childrenCommands = this.$injector.getChildrenCommandsNames(data.prev);

				if (data.words == 1) {
					return tabtab.log(this.allCommands(false), data);
				}

				if (data.last.startsWith("--")) {
					return tabtab.log(Object.keys(require("./options").knownOpts), data, "--");
				}

				if (_.contains(deviceSpecific, data.prev)) {
					return tabtab.log(["ios", "android", "wp8"], data);
				}

				if (data.words == 2 && childrenCommands) {
					return tabtab.log(_.reject(childrenCommands, (children: string) => children[0] === '*'), data);
				}

				if (propSchema) {
					var parseResult = /prop ([^ ]+) ([^ ]*)/.exec(data.line);
					if (parseResult) {
						if (_.contains(propertyCommands, parseResult[1])) {
							var propName = parseResult[2];
							if (propSchema[propName]) {
								var range = propSchema[propName].range;
								if (range) {
									if (!_.isArray(range)) {
										range = _.map(range, (value: { input }, key) => {
											return value.input || key;
										});
									}
									return tabtab.log(range, data);
								}
							} else {
								return tabtab.log(Object.keys(propSchema), data);
							}
						}
					}
				}

				return false;
			});

			return true;
		}).future<any>()();
	}

	private beautifyCommandName(commandName: string): string {
		if(commandName.indexOf("*") > 0) {
			return commandName.substr(0, commandName.indexOf("|"));
		}

		return commandName;
	}
}
$injector.register("commandsService", CommandsService);