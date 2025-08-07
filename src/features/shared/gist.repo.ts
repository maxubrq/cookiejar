export class GistRepo {
    private _ROOT_URL = 'https://api.github.com';
    private static _instance: GistRepo;
    private constructor() { }

    public static getInstance(): GistRepo {
        if (!GistRepo._instance) {
            GistRepo._instance = new GistRepo();
        }
        return GistRepo._instance;
    }

    protected async _fetch<T>(url: string, token: string, options?: RequestInit): Promise<T> {
        const response = await fetch(`${this._ROOT_URL}${url}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...options?.headers,
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json() as Promise<T>;
    }

    /**
     * Get a specific gist by its ID.
     * @param gistId The ID of the gist to retrieve.
     * @param token The authentication token.
     * @returns The requested gist data.
     */
    public async getGist(gistId: string, token: string): Promise<any> {
        return this._fetch(`/gists/${gistId}`, token);
    }

    /**
     * List all gists for the authenticated user.
     * @param token The authentication token.
     * @returns An array of gists.
     */
    public async createGist(gistData: any, token: string): Promise<any> {
        return this._fetch('/gists', token, {
            method: 'POST',
            body: JSON.stringify(gistData),
        });
    }

    /**
     * Update a specific gist by its ID.
     * @param gistId The ID of the gist to update.
     * @param gistData The updated gist data.
     * @param token The authentication token.
     * @returns The updated gist data.
     */
    public async updateGist(gistId: string, gistData: any, token: string): Promise<any> {
        return this._fetch(`/gists/${gistId}`, token, {
            method: 'PATCH',
            body: JSON.stringify(gistData),
        });
    }

    /**
     * Delete a specific gist by its ID.
     * @param gistId The ID of the gist to delete.
     * @param token The authentication token.
     * @returns The response from the API.
     */
    public async deleteGist(gistId: string, token: string): Promise<any> {
        return this._fetch(`/gists/${gistId}`, token, {
            method: 'DELETE',
        });
    }

    /**
     * Find the latest public gist by filename.
     * @param filename The name of the file to search for.
     * @param token The authentication token.
     * @returns The latest gist containing the specified file, or null if not found.
     */
    public async findLatestGistByFilename(filename: string, token: string): Promise<any | null> {
        try {
            const pageSize = 100; // Adjust as needed
            let page = 1;
            let gists: any[] = [];

            while (true) {
                const response = await this._fetch<any[]>(`/gists/public?per_page=${pageSize}&page=${page}`, token);
                if (response.length === 0) break;

                gists = gists.concat(response);
                page++;
            }

            const sortedByUpdatedAt = gists.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
            gists = sortedByUpdatedAt.slice(0, 10); // Limit to the latest 10 gists

            for (const gist of gists) {
                if (gist.files && gist.files[filename]) {
                    return gist;
                }
            }

            return null; // No gist found with the specified filename
        } catch (error) {
            console.error('Error finding latest gist by filename:', error);
            return null;
        }
    }
}