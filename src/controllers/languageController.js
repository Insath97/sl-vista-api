const languages = require("../data/languages.json");

exports.getAllLanguages = (req, res) => {
  try {
    const formattedLanguages = Object.entries(languages).map(
      ([code, data]) => ({
        code,
        name: data.name,
        nativeName: data.nativeName,
        dir: data.dir,
      })
    );

    res.status(200).json({
      success: true,
      count: formattedLanguages.length,
      data: formattedLanguages,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch languages",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.getLanguageByCode = (req, res) => {
  try {
    const { code } = req.params;
    const language = languages[code];

    if (!language) {
      return res.status(404).json({
        success: false,
        message: "Language not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        code,
        ...language,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch language",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
