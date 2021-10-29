"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemixI18NextProvider = exports.useRemixI18Next = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_i18next_1 = require("react-i18next");
const remix_1 = require("remix");
const use_consistent_value_1 = __importDefault(require("use-consistent-value"));
let context = (0, react_1.createContext)(null);
function useI18NextInstance() {
    let value = (0, react_1.useContext)(context);
    if (!value)
        throw new Error("Missing I18Next instance");
    return value;
}
function useRemixI18Next(locale) {
    if (!locale)
        throw new Error("Missing locale");
    let i18next = useI18NextInstance();
    let namespaces = (0, use_consistent_value_1.default)((0, remix_1.useMatches)()
        .flatMap((match) => (match.data.i18n ?? {}))
        // eslint-disable-next-line unicorn/no-array-reduce
        .reduce((messages, routeMessages) => ({ ...messages, ...routeMessages }), {}));
    (0, react_1.useMemo)(() => {
        i18next.changeLanguage(locale);
        for (let [namespace, messages] of Object.entries(namespaces)) {
            i18next.addResourceBundle(locale, namespace, messages);
        }
    }, [i18next, namespaces, locale]);
}
exports.useRemixI18Next = useRemixI18Next;
function RemixI18NextProvider({ children, i18n }) {
    return ((0, jsx_runtime_1.jsx)(context.Provider, Object.assign({ value: i18n }, { children: (0, jsx_runtime_1.jsx)(react_i18next_1.I18nextProvider, Object.assign({ i18n: i18n }, { children: children }), void 0) }), void 0));
}
exports.RemixI18NextProvider = RemixI18NextProvider;
