from pydantic import BaseModel

class UserSessionUpdate(BaseModel):
    username: str

class WatchlistItemAdd(BaseModel):
    username: str
    watchlist_name: str
    ticker: str
    current_price: float