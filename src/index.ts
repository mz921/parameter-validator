import {tryCatchException} from './helper'
import 'reflect-metadata'

const validateMetadataKey = Symbol("validate");

class ParameterError extends Error {
  method: string = "";
  parameterIndexes: number[] = [];
  detail: string[] = [];
  constructor(
    message?: string,
    method?: string,
    parameterIndexes?: number[],
    detail?: string[]
  ) {
    super(message);
    this.method = method || "";
    this.parameterIndexes = parameterIndexes || [];
    this.detail = detail || [];
  }
}

type UnaryPredicate = (arg: unknown) => boolean;

type ValidateFunc = (arg: unknown) => void | never;

interface ValidateSchema {
  requiredParameters?: number[];
  customValidators?: CustomValidator[];
}

type CustomValidator = [number, ValidateFunc, string];

function _validateRequired(requiredParameters: number[], parameters: any[]) {
  let hasError = false;
  let missingIndexes: number[] = [];
  requiredParameters.forEach((parameterIndex) => {
    if (
      parameterIndex >= parameters.length ||
      parameters[parameterIndex] === undefined
    ) {
      hasError = true;
      missingIndexes.push(parameterIndex);
    }
  });
  if (hasError) {
    throw new ParameterError(
      "missing required parameters",
      undefined,
      missingIndexes,
      [`Position parametors ${missingIndexes} must be provided`]
    );
  }
}

// The function should be used as method decorator
function validate(
  target: any,
  methodName: string,
  descriptor: TypedPropertyDescriptor<(...args: any[]) => any>
) {
  const method = descriptor.value;
  descriptor.value = function () {
    const originalArgs = Array.from(arguments);
    const validateSchema: ValidateSchema | undefined = Reflect.getOwnMetadata(
      validateMetadataKey,
      target,
      methodName
    );
    if (validateSchema?.requiredParameters) {
      const errOrVoid = tryCatchException(
        _validateRequired,
        [validateSchema.requiredParameters, originalArgs],
        ParameterError
      );
      if (errOrVoid instanceof ParameterError) {
        errOrVoid.method = methodName;
        throw errOrVoid;
      }
    }
    if (validateSchema?.customValidators) {
      let parameterError: ParameterError | null = null;
      validateSchema?.customValidators.forEach((validator) => {
        const [index, validate, message] = validator;
        const errOrVoid = tryCatchException(
          validate,
          [originalArgs[index]],
          ParameterError
        );
        if (errOrVoid) {
          if (!parameterError) {
            parameterError = new ParameterError(
              `Parametors Error when calling mehtod ${methodName}`,
              methodName,
              [index],
              [`Position parametors ${index} wrong: ${message}`]
            );
          } else {
            parameterError = {
              ...parameterError,
              parameterIndexes: [...parameterError.parameterIndexes, index],
              detail: [
                ...parameterError.detail,
                `Position parametors ${index} wrong: ${message}`,
              ],
            };
          }
        }
      });
      if (parameterError) throw parameterError;
    }
    return method?.call(this, ...originalArgs);
  };
}

function _registerCustomValidator(
  target: Object,
  methodName: string | symbol,
  customeValidator: CustomValidator
) {
  const validateSchema: ValidateSchema | undefined = Reflect.getMetadata(
    validateMetadataKey,
    target,
    methodName
  );
  let customValidators = [customeValidator];
  Reflect.defineMetadata(
    validateMetadataKey,
    {
      ...(validateSchema || {}),
      customValidators: customValidators.concat(
        validateSchema?.customValidators || []
      ),
    },
    target,
    methodName
  );
}

// These functions should be used as parametor decorators
function required(
  target: Object,
  methodName: string | symbol,
  parameterIndex: number
) {
  const validateSchema: ValidateSchema | undefined = Reflect.getMetadata(
    validateMetadataKey,
    target,
    methodName
  );
  let requiredParameters = [parameterIndex];
  Reflect.defineMetadata(
    validateMetadataKey,
    {
      ...(validateSchema || {}),
      requiredParameters: requiredParameters.concat(
        validateSchema?.requiredParameters || []
      ),
    },
    target,
    methodName
  );
}

function predicateWrapper(predicate: UnaryPredicate) {
  return function (arg: any) {
    if (!predicate(arg)) {
      throw new ParameterError();
    }
  };
}

function buildCustomValidator(predicate: UnaryPredicate, message: string) {
  return function (
    target: Object,
    methodName: string | symbol,
    parameterIndex: number
  ) {
    _registerCustomValidator(target, methodName, [
      parameterIndex,
      predicateWrapper(predicate),
      message,
    ]);
  };
}

export {
    validate,
    buildCustomValidator,
    required
}