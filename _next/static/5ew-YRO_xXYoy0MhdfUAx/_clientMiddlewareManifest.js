self.__MIDDLEWARE_MATCHERS = [
  {
    "regexp": "^\\/chaoren-profit(?:\\/(_next\\/data\\/[^/]{1,}))?(?:\\/(\\/?index|\\/?index\\.json|\\/?index(?:\\.rsc|\\.segments\\/.+\\.segment\\.rsc)))?[\\/#\\?]?$",
    "originalSource": "/"
  },
  {
    "regexp": "^\\/chaoren-profit(?:\\/(_next\\/data\\/[^/]{1,}))?\\/login(\\.json|\\.rsc|\\.segments\\/.+\\.segment\\.rsc)?[\\/#\\?]?$",
    "originalSource": "/login"
  },
  {
    "regexp": "^\\/chaoren-profit(?:\\/(_next\\/data\\/[^/]{1,}))?\\/history(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?(\\.json|\\.rsc|\\.segments\\/.+\\.segment\\.rsc)?[\\/#\\?]?$",
    "originalSource": "/history/:path*"
  },
  {
    "regexp": "^\\/chaoren-profit(?:\\/(_next\\/data\\/[^/]{1,}))?\\/calculator(\\.json|\\.rsc|\\.segments\\/.+\\.segment\\.rsc)?[\\/#\\?]?$",
    "originalSource": "/calculator"
  },
  {
    "regexp": "^\\/chaoren-profit(?:\\/(_next\\/data\\/[^/]{1,}))?\\/creator-sampling(\\.json|\\.rsc|\\.segments\\/.+\\.segment\\.rsc)?[\\/#\\?]?$",
    "originalSource": "/creator-sampling"
  },
  {
    "regexp": "^\\/chaoren-profit(?:\\/(_next\\/data\\/[^/]{1,}))?\\/feishu(\\.json|\\.rsc|\\.segments\\/.+\\.segment\\.rsc)?[\\/#\\?]?$",
    "originalSource": "/feishu"
  },
  {
    "regexp": "^\\/chaoren-profit(?:\\/(_next\\/data\\/[^/]{1,}))?\\/account(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?(\\.json|\\.rsc|\\.segments\\/.+\\.segment\\.rsc)?[\\/#\\?]?$",
    "originalSource": "/account/:path*"
  },
  {
    "regexp": "^\\/chaoren-profit(?:\\/(_next\\/data\\/[^/]{1,}))?\\/admin(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?(\\.json|\\.rsc|\\.segments\\/.+\\.segment\\.rsc)?[\\/#\\?]?$",
    "originalSource": "/admin/:path*"
  }
];self.__MIDDLEWARE_MATCHERS_CB && self.__MIDDLEWARE_MATCHERS_CB()