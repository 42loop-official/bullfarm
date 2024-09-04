export interface ITradeParam {
    address: string;
    amount: string;
    slippage?: number;
    type: "buy" | "sell";
}