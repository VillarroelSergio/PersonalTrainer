import { FlatCompat } from "@eslint/eslintrc";
import { globalIgnores } from "eslint/config";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
const config = [...compat.extends("next/core-web-vitals")];
const flatConfig = [globalIgnores(["**/.next/**"]), ...config];

export default flatConfig;
