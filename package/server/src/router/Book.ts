import Book from "contract/router/Book";
import { setup } from "./setup";

export default setup(({ gel, tsr }) => tsr.router(Book, {}));
