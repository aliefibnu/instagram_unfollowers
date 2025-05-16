// Constants
const INSTAGRAM_HOSTNAME = "www.instagram.com";
const WHITELISTED_STORAGE_KEY = "iu_whitelisted-results";
const DEFAULT_TIME_BETWEEN_SEARCH_CYCLES = 1000; // 1s
const TIME_TO_WAIT_AFTER_FIVE_SEARCH_CYCLES = 10000; // 10s
const DEFAULT_TIME_BETWEEN_UNFOLLOWS = 4000; // 4s
const TIME_TO_WAIT_AFTER_FIVE_UNFOLLOWS = 300000; // 5min

// Declare
let results = [];
let hasNextPage = true;
let totalCount = -1;
let percentage = 0;
let fetchedCount = 0;
let status_now = "initial"; // initial, fetching, unfollowing, error
let whitelistedResults = JSON.parse(
  localStorage.getItem(WHITELISTED_STORAGE_KEY) || "[]"
);
let unfollowLog = [];
let searchCycleCount = 0;
let filterState = "all"; // all, following_back, not_following_back

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  return parts.length === 2 ? parts.pop().split(";").shift() : null;
}

function urlGenerator(cursor) {
  const userId = getCookie("ds_user_id");
  if (!userId) throw new Error("User ID cookie not found");
  const baseUrl = `https://www.instagram.com/graphql/query/?query_hash=3dec7e2c57367ef3da3d987d89f9dbc8&variables={"id":"${userId}","include_reel":"true","fetch_mutual":"false","first":"24"`;
  return cursor ? `${baseUrl},"after":"${cursor}"}` : `${baseUrl}}`;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchData(cursor = null) {
  try {
    if (searchCycleCount >= 5) {
      console.log("Pausing after 5 search cycles...");
      await sleep(TIME_TO_WAIT_AFTER_FIVE_SEARCH_CYCLES);
      searchCycleCount = 0;
    }

    status_now = "fetching";
    const url = urlGenerator(cursor);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const json = await response.json();
    const edge_follow = json?.data?.user?.edge_follow;

    if (!edge_follow) {
      throw new Error("Invalid response structure from Instagram API");
    }

    if (totalCount === -1) {
      totalCount = edge_follow.count;
    }

    const results_now = edge_follow.edges.map((edge) => ({
      id: edge.node.id,
      username: edge.node.username,
      full_name: edge.node.full_name,
      profile_pic_url: edge.node.profile_pic_url,
      is_verified: edge.node.is_verified,
      is_private: edge.node.is_private,
      follows_viewer: edge.node.follows_viewer,
    }));

    results.push(...results_now);
    fetchedCount = results.length;
    percentage = Math.floor((fetchedCount / totalCount) * 100);
    hasNextPage = edge_follow.page_info.has_next_page;
    const nextCursor = edge_follow.page_info.end_cursor;

    searchCycleCount++;
    await sleep(DEFAULT_TIME_BETWEEN_SEARCH_CYCLES);

    rewriteBody(); // Update UI after each fetch

    return {
      results_now,
      hasNextPage,
      nextCursor,
    };
  } catch (error) {
    console.error("Error in fetchData:", error.message);
    status_now = "error";
    hasNextPage = false;
    rewriteBody();
    throw error;
  }
}

function getUserCard() {
  let filteredResults = results;
  if (filterState === "following_back") {
    filteredResults = results.filter((user) => user.follows_viewer);
  } else if (filterState === "not_following_back") {
    filteredResults = results.filter((user) => !user.follows_viewer);
  }

  return filteredResults.map(
    (user) =>
      `<div class="user-card">
        <img src="${user.profile_pic_url}" alt="${user.username}">
        <div class="user-info">
          <div class="username">
            ${user.username}
            ${user.is_verified ? '<span class="verified">✔</span>' : ""}
          </div>
          <p class="full-name">${user.full_name || "Tanpa nama"}</p>
          <div class="status-tags">
            <span class="status-tag ${user.is_private ? "private" : "public"}">
              ${user.is_private ? "Pribadi" : "Publik"}
            </span>
            <span class="status-tag ${
              user.follows_viewer ? "follows" : "not-follows"
            }">
              ${user.follows_viewer ? "Mengikuti Anda" : "Tidak Mengikuti"}
            </span>
          </div>
        </div>
      </div>`
  );
}

function rewriteBody() {
  const style = `
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        font-family: Arial, sans-serif;
      }

      body {
        min-height: 100vh;
        background: linear-gradient(135deg, #f9e1e8, #e6e6fa, #e0f7fa);
        padding: 20px;
        color: #333;
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
      }

      h1 {
        font-size: 2rem;
        text-align: center;
        margin-bottom: 20px;
        color: #4a4a4a;
      }

      .menu-section {
        display: flex;
        gap: 10px;
        justify-content: center;
        margin-bottom: 20px;
      }

      .menu-button {
        padding: 10px 20px;
        border: none;
        border-radius: 5px;
        background: linear-gradient(to right, #ff99cc, #cc99ff);
        color: white;
        font-weight: bold;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .menu-button:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
      }

      .menu-button.active {
        background: linear-gradient(to right, #cc66aa, #9966cc);
      }

      .progress-section {
        background: rgba(255, 255, 255, 0.8);
        border-radius: 10px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
        backdrop-filter: blur(5px);
      }

      .progress-info {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
        font-size: 1rem;
        font-weight: bold;
        color: #555;
      }

      .progress-bar {
        width: 100%;
        height: 10px;
        background: #e0e0e0;
        border-radius: 5px;
        overflow: hidden;
      }

      .progress-bar-fill {
        height: 100%;
        background: linear-gradient(to right, #ff99cc, #cc99ff);
        transition: width 0.3s ease;
      }

      .users-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 20px;
      }

      .user-card {
        background: rgba(255, 255, 255, 0.8);
        border-radius: 10px;
        padding: 15px;
        display: flex;
        align-items: center;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
        transition: transform 0.2s, box-shadow 0.2s;
        backdrop-filter: blur(5px);
      }

      .user-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 6px 15px rgba(0, 0, 0, 0.15);
      }

      .user-card img {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid #ffd1dc;
        margin-right: 15px;
      }

      .user-info {
        flex: 1;
      }

      .username {
        font-size: 1.2rem;
        font-weight: bold;
        color: #4a4a4a;
        display: flex;
        align-items: center;
      }

      .verified {
        color: #3399ff;
        margin-left: 5px;
        font-size: 0.9rem;
      }

      .full-name {
        font-size: 0.9rem;
        color: #666;
        margin: 5px 0;
      }

      .status-tags {
        display: flex;
        gap: 8px;
        margin-top: 5px;
      }

      .status-tag {
        font-size: 0.75rem;
        padding: 4px 8px;
        border-radius: 12px;
      }

      .private {
        background: #e6ccff;
        color: #663399;
      }

      .public {
        background: #ccffcc;
        color: #339933;
      }

      .follows {
        background: #b3d9ff;
        color: #0066cc;
      }

      .not-follows {
        background: #e6e6e6;
        color: #666;
      }

      .status-message {
        text-align: center;
        margin-top: 20px;
        font-size: 1.1rem;
        font-weight: medium;
        color: #555;
      }

      @media (max-width: 768px) {
        h1 {
          font-size: 1.5rem;
        }

        .progress-info {
          flex-direction: column;
          gap: 10px;
          font-size: 0.9rem;
        }

        .menu-section {
          flex-direction: column;
          align-items: center;
        }

        .menu-button {
          width: 100%;
          max-width: 200px;
        }

        .users-grid {
          grid-template-columns: 1fr;
        }

        .user-card {
          padding: 10px;
        }

        .user-card img {
          width: 50px;
          height: 50px;
        }

        .username {
          font-size: 1rem;
        }

        .full-name {
          font-size: 0.8rem;
        }
      }

      @media (max-width: 480px) {
        body {
          padding: 10px;
        }

        .container {
          padding: 0;
        }

        .progress-section {
          padding: 15px;
        }

        .status-message {
          font-size: 1rem;
        }
      }
    </style>
  `;

  const statusText =
    status_now === "fetching"
      ? "Mengambil data pengguna..."
      : status_now === "completed"
      ? "Semua pengguna telah diambil!"
      : status_now === "error"
      ? "Terjadi kesalahan saat mengambil data"
      : "Siap untuk mengambil data";

  document.body.innerHTML = `
    ${style}
    <div class="container">
      <h1>Daftar Pengikut Instagram Anda</h1>
      <div class="menu-section">
        <button class="menu-button all-button ${
          filterState === "all" ? "active" : ""
        }" data-filter="all">Semua</button>
        <button class="menu-button following-back-button ${
          filterState === "following_back" ? "active" : ""
        }" data-filter="following_back">Mengikuti Balik</button>
        <button class="menu-button not-following-back-button ${
          filterState === "not_following_back" ? "active" : ""
        }" data-filter="not_following_back">Tidak Mengikuti Balik</button>
      </div>
      <div class="progress-section">
        <div class="progress-info">
          <span>Progres: <span id="progress">${percentage}%</span></span>
          <span>Total Diambil: <span id="total">${fetchedCount} / ${totalCount}</span></span>
        </div>
        <div class="progress-bar">
          <div id="progress-bar" class="progress-bar-fill" style="width: ${percentage}%"></div>
        </div>
      </div>
      <div class="users-grid">
        ${getUserCard().join("")}
      </div>
      <div class="status-message">
        <p id="status">${statusText}</p>
      </div>
    </div>
  `;

  // Add event listeners for buttons
  document.querySelectorAll(".menu-button").forEach((button) => {
    button.addEventListener("click", () => {
      filterState = button.getAttribute("data-filter");
      rewriteBody();
    });
  });
}

window.rewriteBody = rewriteBody;

async function main() {
  if (status_now !== "initial") {
    console.error("Scan already in progress or completed");
    return;
  }

  try {
    rewriteBody(); // Initial UI render
    let cursor = null;
    while (hasNextPage) {
      const {
        results_now,
        hasNextPage: nextPage,
        nextCursor,
      } = await fetchData(cursor);
      console.log(
        `Fetched ${results_now.length} users, Total: ${fetchedCount}, Progress: ${percentage}%`
      );
      cursor = nextCursor;
    }
    console.log("Finished fetching all followings:", results);
    status_now = "completed";
  } catch (error) {
    console.error("Error in main:", error.message);
    status_now = "error";
  } finally {
    rewriteBody(); // Final UI update
  }
}

// Run in console
main();
