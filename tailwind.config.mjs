/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        login: "url('/images/login.png')",
        home: "url('/images/home.png')",
        tokenize: "url('/images/fundoTokenize.png')",
        "footer-texture": "url('/img/footer-texture.png')",
      },
      colors: {
        "green-primary": "#98C73B",
        "green-secondary": "#0B3534",
      },
    },
  },
  plugins: [require("daisyui")],
};
